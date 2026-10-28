import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Icon } from './Icon';

// Fix Leaflet's default icon path issues in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition({ lat: e.latlng.lat, lon: e.latlng.lng, source: 'manual' });
    },
  });

  return position ? <Marker position={[position.lat, position.lon]} /> : null;
}

export function LocationPicker({ location, setLocation }) {
  const [showMap, setShowMap] = useState(false);
  const defaultCenter = [12.9716, 77.5946]; // Bengaluru

  const handleLocate = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude, source: 'gps' }),
        () => setShowMap(true)
      );
    } else {
      setShowMap(true);
    }
  };

  const map = (center, zoom) => (
    <div className="map">
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <LocationMarker position={location} setPosition={setLocation} />
      </MapContainer>
    </div>
  );

  if (location) {
    return (
      <div className="location">
        {map([location.lat, location.lon], 16)}
        <div className="location-bar">
          <Icon name="pin" size={18} />
          <span className="mono">{location.lat.toFixed(5)}, {location.lon.toFixed(5)}</span>
          <span className="chip">{(location.source || 'unknown').replace('_', ' ')}</span>
          <span className="location-tip">Tap the map to adjust</span>
        </div>
      </div>
    );
  }

  return (
    <div className="location">
      <div className="location-actions">
        <button type="button" className="btn btn-soft" onClick={handleLocate}>
          <Icon name="locate" size={18} /> Use my location
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setShowMap(true)}>
          <Icon name="map" size={18} /> Pick on map
        </button>
      </div>
      {showMap && map(defaultCenter, 12)}
    </div>
  );
}
