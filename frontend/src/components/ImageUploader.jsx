import React, { useRef, useState } from 'react';
import { extractGPS } from '../utils/exif';
import { Icon } from './Icon';

export function ImageUploader({ images, setImages, setLocation, onLiveScan }) {
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [error, setError] = useState('');

  const handleFileChange = async (e, source) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    if (images.length + files.length > 5) {
      setError('Maximum 5 images allowed');
      return;
    }
    setError('');

    const newImages = [];
    let locatedFromExif = false;
    
    for (const file of files) {
      const url = URL.createObjectURL(file);
      newImages.push({ file, url });
      
      // Try to get GPS from file if it's from gallery
      if (source === 'gallery') {
        const gps = await extractGPS(file);
        if (gps) {
          setLocation({ ...gps, source: 'photo_gps' });
          locatedFromExif = true;
        }
      }
    }

    // Location for every photo: EXIF GPS from the gallery file when present,
    // otherwise the device's current position
    const hasExif = source === 'gallery' && locatedFromExif;
    if (!hasExif && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            source: source === 'camera' ? 'camera' : 'device_gps'
          });
        },
        (err) => {
          console.warn('Geolocation failed:', err.message);
        }
      );
    }

    setImages(prev => [...prev, ...newImages]);
    
    // Reset inputs
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const removeImage = (index) => {
    setImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].url);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  return (
    <div className="uploader">
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        ref={cameraInputRef} 
        style={{ display: 'none' }} 
        onChange={(e) => handleFileChange(e, 'camera')}
      />
      <input 
        type="file" 
        accept="image/*" 
        multiple 
        ref={galleryInputRef} 
        style={{ display: 'none' }} 
        onChange={(e) => handleFileChange(e, 'gallery')}
      />

      <div className={`capture-grid${onLiveScan ? '' : ' two'}`}>
        {onLiveScan && (
          <button type="button" className="capture-tile featured" onClick={onLiveScan} disabled={images.length >= 5}>
            <span className="capture-icon"><Icon name="scan" size={22} /></span>
            <span className="capture-title">Live detection</span>
            <span className="capture-sub">Finds potholes, garbage, fallen trees and more</span>
          </button>
        )}
        <button type="button" className="capture-tile" onClick={() => cameraInputRef.current?.click()} disabled={images.length >= 5}>
          <span className="capture-icon"><Icon name="camera" size={22} /></span>
          <span className="capture-title">Camera</span>
          <span className="capture-sub">Take a photo</span>
        </button>
        <button type="button" className="capture-tile" onClick={() => galleryInputRef.current?.click()} disabled={images.length >= 5}>
          <span className="capture-icon"><Icon name="image" size={22} /></span>
          <span className="capture-title">Gallery</span>
          <span className="capture-sub">Choose photos</span>
        </button>
      </div>
      {error && <p className="field-error">{error}</p>}

      {images.length > 0 && (
        <div className="thumbs">
          {images.map((img, idx) => (
            <div key={img.url} className="thumb">
              <img src={img.url} alt={`Photo ${idx + 1}`} />
              <button type="button" className="thumb-remove" onClick={() => removeImage(idx)} aria-label="Remove photo">
                <Icon name="x" size={14} strokeWidth={2.6} />
              </button>
            </div>
          ))}
          <span className="thumbs-count">{images.length}/5</span>
        </div>
      )}
    </div>
  );
}
