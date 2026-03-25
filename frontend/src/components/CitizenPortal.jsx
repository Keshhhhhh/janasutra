import React, { useState } from 'react';
import { Container, Form, Button, Row, Col, Card, Alert, ProgressBar, Badge } from 'react-bootstrap';

export const CitizenPortal = () => {
    const [complaint, setComplaint] = useState({ description: '', lat: null, lng: null });
    const [image, setImage] = useState(null);
    const [status, setStatus] = useState(null); // 'idle', 'submitting', 'tracked'
    const [ticketInfo, setTicketInfo] = useState(null);

    // HTML5 Native Geolocation Extraction
    const captureLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setComplaint({ ...complaint, lat: position.coords.latitude, lng: position.coords.longitude });
                },
                (error) => alert('Geolocation failed. Please ensure permissions are granted.')
            );
        }
    };

    const handleSubmission = async (e) => {
        e.preventDefault();
        setStatus('submitting');
        
        // Simulating the closed-loop API execution against our Python FastAPI mapped bounds
        setTimeout(() => {
            setStatus('tracked');
            setTicketInfo({
                ticketId: "MST-8014",
                verified: true,
                priority: "P2 - High",
                sla: "24 Hours",
                confidence: "94.2%",
                updates: [
                    { time: "Just Now", status: "Ingested via AI PostGIS Core" },
                    { time: "Pending", status: "Public Works Department Dispatch" }
                ]
            });
        }, 1500);
    };

    return (
        <Container className="mt-4">
            <h2 className="mb-4">Civic Hazard Reporter</h2>
            
            {status !== 'tracked' ? (
                <Card className="shadow-sm border-0">
                    <Card.Body>
                        <Form onSubmit={handleSubmission}>
                            <Form.Group className="mb-3">
                                <Form.Label>Detailed Issue Description</Form.Label>
                                <Form.Control 
                                    as="textarea" rows={3} required
                                    placeholder="Describe the pothole, garbage dump, or broken pipe..."
                                    value={complaint.description}
                                    onChange={(e) => setComplaint({...complaint, description: e.target.value})}
                                />
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label>Photographic Evidence</Form.Label>
                                <Form.Control type="file" accept="image/*" required onChange={(e) => setImage(e.target.files[0])} />
                                <Form.Text className="text-muted">
                                    Our AI ELA pipeline validates image authenticity securely.
                                </Form.Text>
                            </Form.Group>

                            <Row className="mb-4">
                                <Col md={8}>
                                    <Button variant="outline-secondary" onClick={captureLocation} className="w-100">
                                        <i className="bi bi-geo-alt"></i> 1. Capture Precise GPS Coordinates
                                    </Button>
                                </Col>
                                <Col md={4} className="d-flex align-items-center text-success">
                                    {complaint.lat && <strong>✓ Location Locked</strong>}
                                </Col>
                            </Row>

                            <Button variant="primary" type="submit" className="w-100" disabled={!complaint.lat || status === 'submitting'}>
                                {status === 'submitting' ? 'AI Pipeline Validating...' : 'Submit Complaint Securely'}
                            </Button>
                        </Form>
                    </Card.Body>
                </Card>
            ) : (
                <Card className="shadow-sm border-0 border-top border-success border-4">
                    <Card.Body>
                        <h4><Badge bg="success">Verified</Badge> Master Ticket #{ticketInfo.ticketId} Created!</h4>
                        <p className="mt-3">
                            Unlike Sahaaya 2.0, our AI dynamically tracks and deduplicates your issue natively, pushing it strictly against enforceable SLA dispatch requirements. 
                        </p>
                        
                        <Row className="mt-4">
                            <Col md={3}><strong>Assigned Urgency:</strong><br/> <Badge bg="warning" text="dark">{ticketInfo.priority}</Badge></Col>
                            <Col md={3}><strong>SLA Dispatch Rules:</strong><br/> Executing within {ticketInfo.sla}</Col>
                            <Col md={3}><strong>AI Verification:</strong><br/> {ticketInfo.confidence} Authenticity</Col>
                        </Row>

                        <div className="mt-5">
                            <h5>Live Department Routing Status:</h5>
                            <ProgressBar animated variant="info" now={50} className="mb-2" />
                            <ul>
                                {ticketInfo.updates.map((update, idx) => (
                                    <li key={idx}><strong>{update.time}:</strong> {update.status}</li>
                                ))}
                            </ul>
                        </div>
                    </Card.Body>
                </Card>
            )}
        </Container>
    );
};
