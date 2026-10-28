import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImageUploader } from '../components/ImageUploader';
import { LiveCameraDetector } from '../components/LiveCameraDetector';
import { LocationPicker } from '../components/LocationPicker';
import { PriorityBadge } from '../components/PriorityBadge';
import { AiReview, canSubmit } from '../components/AiReview';
import { api, categoryLabel } from '../utils/api';
import { checkPhoto } from '../utils/authenticityCheck';
import { Icon } from '../components/Icon';
import { loadCivicDetectors, analyseImage, fileToImage, describeFindings } from '../utils/civicDetect';

function StepHead({ n, title, hint, done }) {
  return (
    <div className="step-head">
      <span className={`step-num${done ? ' done' : ''}`}>{done ? <Icon name="check" size={15} strokeWidth={3} /> : n}</span>
      <div>
        <h2 className="step-title">{title}</h2>
        {hint && <p className="step-hint">{hint}</p>}
      </div>
    </div>
  );
}

export function ReportPage() {
  const [images, setImages] = useState([]);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [showLiveScan, setShowLiveScan] = useState(false);
  const [liveDetection, setLiveDetection] = useState(null);
  // Authenticity result per image url: { verdict, flagged, reasons } or 'checking'
  const [photoChecks, setPhotoChecks] = useState({});
  // Civic AI review step (POST /api/ai/analyze), done before submitting
  const [locality, setLocality] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [rural, setRural] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analysisFailed, setAnalysisFailed] = useState(false);
  const [choices, setChoices] = useState({});
  const [draftText, setDraftText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [taxonomy, setTaxonomy] = useState({});

  useEffect(() => {
    api.get('/ai/taxonomy').then(t => {
      const map = {};
      t.categories.forEach(c => c.subcategories.forEach(sub => {
        map[sub.id] = { ...sub, category_name_en: c.name_en };
      }));
      setTaxonomy(map);
    }).catch(() => {});
  }, []);

  // Any change to what was analysed makes the analysis stale
  useEffect(() => {
    setAnalysis(null);
    setAnalysisFailed(false);
    setChoices({});
  }, [images, description, location, locality, pinCode, rural]);

  const runAnalysis = async (nextChoices = choices, previous = null) => {
    setAnalyzing(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('description', description);
      if (location) {
        formData.append('latitude', location.lat);
        formData.append('longitude', location.lon);
      }
      if (locality.trim()) formData.append('locality', locality.trim());
      if (pinCode.trim()) formData.append('pin_code', pinCode.trim());
      if (rural) formData.append('rural', 'true');
      if (nextChoices.confirmed_subcategory_id) formData.append('confirmed_subcategory_id', nextChoices.confirmed_subcategory_id);
      if (nextChoices.city_corporation_id) formData.append('city_corporation_id', nextChoices.city_corporation_id);
      formData.append('draft_language', nextChoices.draft_language || 'en');
      if (previous) {
        formData.append('analysis_id', previous.analysis_id);
      } else {
        images.forEach(img => formData.append('images', img.file));
        if (liveDetection) formData.append('live_detection', 'true');
      }
      const result = await api.upload('/ai/analyze', formData);
      setAnalysis(result);
      setChoices(nextChoices);
      setDraftText(result.complaint_draft ? `${result.complaint_draft.subject}\n\n${result.complaint_draft.body}` : '');
    } catch (err) {
      if (previous && /expired/i.test(err.message || '')) return runAnalysis(nextChoices, null);
      setAnalysisFailed(true);
      setError(`AI check unavailable (${err.message}). You can still submit the report.`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleChoose = (patch, { rerun = true } = {}) => {
    const next = { ...choices, ...patch };
    if ('confirmed_subcategory_id' in patch) next.confirmed_authority_id = null;  // authority depends on the issue
    setChoices(next);
    if (rerun) runAnalysis(next, analysis);
  };

  useEffect(() => {
    images.forEach((img) => {
      if (photoChecks[img.url]) return;
      setPhotoChecks(prev => ({ ...prev, [img.url]: 'checking' }));
      checkPhoto(img.file, { live: !!img.live })
        .then(result => setPhotoChecks(prev => ({ ...prev, [img.url]: result })))
        .catch(() => setPhotoChecks(prev => ({ ...prev, [img.url]: { verdict: 'unknown', flagged: false, reasons: [] } })));
    });
  }, [images]);

  // On-device detection on every photo (uploaded or live): what the photo shows
  const [findings, setFindings] = useState({});
  const descTouched = React.useRef(false);
  useEffect(() => {
    images.forEach((img) => {
      if (findings[img.url]) return;
      if (img.items) {
        setFindings((prev) => ({ ...prev, [img.url]: img.items }));
        return;
      }
      setFindings((prev) => ({ ...prev, [img.url]: 'checking' }));
      loadCivicDetectors()
        .then(() => fileToImage(img.file))
        .then((el) => analyseImage(el))
        .then((items) => setFindings((prev) => ({ ...prev, [img.url]: items })))
        .catch(() => setFindings((prev) => ({ ...prev, [img.url]: [] })));
    });
  }, [images]);
  const found = images.map((img) => findings[img.url]).filter(Array.isArray).flat();
  const merged = Object.values(found.reduce((acc, i) => {
    const prev = acc[i.name];
    acc[i.name] = prev ? { ...prev, confidence: Math.max(prev.confidence, i.confidence), count: prev.count + i.count } : { ...i };
    return acc;
  }, {})).sort((a, b) => b.confidence - a.confidence);
  const detecting = images.some((img) => findings[img.url] === 'checking');
  // Suggest a description from what the photos show, until the citizen types their own
  useEffect(() => {
    if (!descTouched.current && merged.length && !detecting) {
      setDescription(`${describeFindings(merged)} — needs attention.`.slice(0, 500));
    }
  }, [detecting, merged.length]);

  const flaggedPhotos = images.map(img => photoChecks[img.url]).filter(c => c && c !== 'checking' && c.flagged);

  const handleLiveDetected = ({ file, location: detectedLocation, capturedAt, detection, items }) => {
    setShowLiveScan(false);
    setImages(prev => [...prev, { file, url: URL.createObjectURL(file), live: true, items }]);
    if (detectedLocation) setLocation(detectedLocation);

    const when = capturedAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    const where = detectedLocation ? ` near ${detectedLocation.lat.toFixed(5)}, ${detectedLocation.lon.toFixed(5)}` : '';
    const what = items.length ? describeFindings(items) : 'Civic problem';
    descTouched.current = true;
    setDescription(`${what} seen by live camera${where} on ${when}.`.slice(0, 500));
    setLiveDetection({ capturedAt, confidence: detection.max_confidence, labels: items.map((i) => i.label), hasLocation: !!detectedLocation });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!images.length || !description || !location) {
      setError('Please provide an image, description, and location.');
      return;
    }
    if (!analysis && !analysisFailed) {
      runAnalysis({}, null);
      return;
    }
    if (!canSubmit(analysis, choices)) return;

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('description', description);
      formData.append('latitude', location.lat);
      formData.append('longitude', location.lon);
      formData.append('location_source', location.source || 'manual');
      if (liveDetection) {
        formData.append('captured_at', liveDetection.capturedAt.toISOString());
        formData.append('live_detection', 'true');
      }
      
      images.forEach((img) => {
        formData.append('images', img.file);
      });
      if (locality.trim()) formData.append('locality', locality.trim());
      if (pinCode.trim()) formData.append('pin_code', pinCode.trim());
      if (rural) formData.append('rural', 'true');
      if (analysis) {
        formData.append('analysis_id', analysis.analysis_id);
        if (choices.confirmed_subcategory_id) formData.append('confirmed_subcategory_id', choices.confirmed_subcategory_id);
        if (choices.city_corporation_id) formData.append('city_corporation_id', choices.city_corporation_id);
        if (choices.confirmed_authority_id) formData.append('confirmed_authority_id', choices.confirmed_authority_id);
        if (draftText.trim()) formData.append('complaint_text', draftText.trim());
      }

      const response = await api.upload('/complaints', formData);
      setResult(response);
    } catch (err) {
      setError(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const [copied, setCopied] = useState(false);
  const copyTicketId = () => {
    if (result?.ticket_id) {
      navigator.clipboard?.writeText(result.ticket_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleReset = () => {
    setImages([]);
    setDescription('');
    setLocation(null);
    setLiveDetection(null);
    setResult(null);
    setError('');
    setLocality('');
    setPinCode('');
    setRural(false);
  };

  if (result) {
    const unconfirmed = ['registry_unconfirmed', 'unresolved'].includes(result.department_basis);
    return (
      <div className="shell narrow">
        <div className="panel success">
          <div className="success-badge"><Icon name="check" size={34} strokeWidth={2.6} /></div>
          <h1 className="h2">Report submitted</h1>
          <p className="muted">Thank you. Officials will see your report with the photo and location.</p>

          <button type="button" className="ticket" onClick={copyTicketId} title="Copy ticket ID">
            <span className="ticket-label">Ticket ID</span>
            <span className="ticket-value">{result.ticket_id}</span>
            <span className="ticket-copy"><Icon name={copied ? 'check' : 'copy'} size={16} /> {copied ? 'Copied' : 'Copy'}</span>
          </button>

          <dl className="facts two">
            {result.department && <div><dt>Sent to</dt><dd>{result.department}{unconfirmed && <span className="muted"> · to be confirmed</span>}</dd></div>}
            {result.category && <div><dt>Category</dt><dd>{categoryLabel(result.category)}</dd></div>}
            {result.priority && <div><dt>Priority</dt><dd><PriorityBadge priority={result.priority} /></dd></div>}
          </dl>

          <div className="stack-sm">
            <Link to={`/track/${result.ticket_id}`} className="btn btn-primary btn-full">Track this report <Icon name="arrow" size={18} /></Link>
            <button onClick={handleReset} className="btn btn-ghost btn-full">Report another issue</button>
          </div>
        </div>
      </div>
    );
  }

  const step1 = images.length > 0, step2 = description.trim().length > 0, step3 = !!location;
  return (
    <div className="shell narrow">
      <header className="page-head">
        <span className="eyebrow">New report</span>
        <h1>What needs fixing?</h1>
        <p className="muted">Add a photo, say what is wrong and where. JanaSutra works out the problem and the
          responsible authority, and you check everything before it is sent.</p>
      </header>

      <form onSubmit={handleSubmit} className="stack">
        <section className="panel step">
          <StepHead n={1} done={step1} title="Photo" hint="Up to 5 clear photos of the problem" />
          <ImageUploader
            images={images}
            setImages={setImages}
            setLocation={setLocation}
            onLiveScan={() => setShowLiveScan(true)}
          />
          {images.length > 0 && (detecting || merged.length > 0) && (
            <div className="notice ok appear">
              <Icon name="scan" />
              <div>
                <strong>{detecting ? 'Checking your photos…' : 'Found in your photos'}</strong>
                {merged.length > 0 && (
                  <div className="detected mt-1">
                    {merged.map((i) => <span key={i.name} className="chip">{i.label}{i.count > 1 ? ` ×${i.count}` : ''} · {Math.round(i.confidence * 100)}%</span>)}
                  </div>
                )}
              </div>
            </div>
          )}
          {images.length > 0 && !detecting && merged.length === 0 && Object.keys(findings).length > 0 && (
            <p className="muted small">No problem was recognised automatically — describe it below and the AI will classify it from your words.</p>
          )}
          {flaggedPhotos.length > 0 && (
            <div className="notice warn">
              <Icon name="alert" />
              <div>
                <strong>This may not be a real, live photo of the issue</strong>
                <ul>{[...new Set(flaggedPhotos.flatMap(c => c.reasons))].map(r => <li key={r}>{r}</li>)}</ul>
                <p>Please photograph the actual place. You can still submit; the report will be marked for verification.</p>
              </div>
            </div>
          )}
          {liveDetection && (
            <div className="notice ok">
              <Icon name="scan" />
              <div>
                <strong>{liveDetection.labels.length ? `Live detection: ${liveDetection.labels.join(', ')}` : 'Captured with live detection'}</strong>
                <p>Captured {liveDetection.capturedAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  {liveDetection.hasLocation ? ' · location from GPS' : ' · GPS unavailable, set the location below'}</p>
              </div>
            </div>
          )}
        </section>

        <section className="panel step">
          <StepHead n={2} done={step2} title="What is wrong?" hint="A sentence is enough — English or ಕನ್ನಡ" />
          <div className="field">
            <textarea
              className="input textarea"
              rows={3}
              placeholder="e.g. Deep pothole near the bus stop, bikes are skidding"
              value={description}
              onChange={(e) => { descTouched.current = true; setDescription(e.target.value.slice(0, 500)); }}
            />
            <span className="counter">{description.length}/500</span>
          </div>
        </section>

        <section className="panel step">
          <StepHead n={3} done={step3} title="Where is it?" hint="Location decides which authority gets it" />
          <LocationPicker location={location} setLocation={setLocation} />
          <div className="row-2">
            <label className="field">
              <span className="label">Locality or landmark <em>optional</em></span>
              <input type="text" className="input" placeholder="e.g. Jayanagar 4th Block"
                value={locality} onChange={(e) => setLocality(e.target.value.slice(0, 120))} />
            </label>
            <label className="field">
              <span className="label">PIN code <em>optional</em></span>
              <input type="text" inputMode="numeric" className="input" placeholder="560041"
                value={pinCode} onChange={(e) => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            </label>
          </div>
          <label className="switch">
            <input type="checkbox" checked={rural} onChange={(e) => setRural(e.target.checked)} />
            <span className="switch-track" aria-hidden="true"><span className="switch-thumb" /></span>
            <span>It is in a village (Gram Panchayat area)</span>
          </label>
        </section>

        {analysis && (
          <section className="panel step appear">
            <StepHead n={4} done={canSubmit(analysis, choices) && analysis.status !== 'out_of_scope'} title="Check and confirm"
              hint="What the AI found — change anything that is wrong" />
            <AiReview
              analysis={analysis}
              taxonomy={taxonomy}
              choices={choices}
              onChoose={handleChoose}
              draftText={draftText}
              setDraftText={setDraftText}
              busy={analyzing}
            />
          </section>
        )}

        {error && <div className="notice error"><Icon name="alert" /><div>{error}</div></div>}

        <div className="action-bar">
          {analysis && (
            <button type="button" className="btn btn-ghost" disabled={analyzing} onClick={() => runAnalysis({}, null)}>
              <Icon name="refresh" size={18} /> Re-check
            </button>
          )}
          <button
            type="submit"
            className="btn btn-primary btn-lg grow"
            disabled={!images.length || !description || !location || loading || analyzing
              || (analysis && !canSubmit(analysis, choices))}
          >
            {loading ? <><span className="spin" /> Submitting…</>
              : analyzing ? <><span className="spin" /> Checking photo and text…</>
              : (!analysis && !analysisFailed) ? <>Check report <Icon name="arrow" size={18} /></>
              : analysis?.status === 'out_of_scope' ? 'Not a civic issue'
              : <>Submit report <Icon name="arrow" size={18} /></>}
          </button>
        </div>
        {!(step1 && step2 && step3) && (
          <p className="hint-line">
            Still needed: {[!step1 && 'a photo', !step2 && 'a description', !step3 && 'the location'].filter(Boolean).join(', ')}
          </p>
        )}
      </form>

      {showLiveScan && (
        <LiveCameraDetector
          onDetected={handleLiveDetected}
          onClose={() => setShowLiveScan(false)}
        />
      )}
    </div>
  );
}
