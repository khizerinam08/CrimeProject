import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for Leaflet marker icon issue in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Component to handle map clicks
function LocationMarker({ position, setPosition, locationLocked }) {
  const map = useMapEvents({
    click: (e) => {
      if (!locationLocked) {
        setPosition([e.latlng.lat, e.latlng.lng]);
      }
    },
  });

  useEffect(() => {
    if (position) {
      map.flyTo(position, map.getZoom());
    }
    
    // Forces a resize event on the map to fix rendering issues
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [position, map]);

  return position ? <Marker position={position} /> : null;
}

function MapModal({ isOpen, onClose, onSelectLocation, embedded = false, locationLocked = false, selectedLocation = null }) {
  const [position, setPosition] = useState(selectedLocation);
  const defaultPosition = [41.88, -87.63]; // Default to Chicago

  // Update position when selectedLocation changes
  useEffect(() => {
    if (selectedLocation) {
      setPosition(selectedLocation);
    }
  }, [selectedLocation]);

  // Handle confirm button click
  const handleConfirm = () => {
    if (position) {
      onSelectLocation(position);
      if (!embedded) {
        onClose();
      }
    }
  };
  
  // Force map to recalculate size when it becomes visible
  useEffect(() => {
    if (isOpen || embedded) {
      // Short delay to ensure the component is rendered
      const timer = setTimeout(() => {
        const mapElement = document.querySelector('.leaflet-container');
        if (mapElement && mapElement._leaflet_id) {
          const map = L.DomUtil.get(mapElement)._leaflet;
          if (map) {
            map.invalidateSize();
          }
        }
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, embedded]);

  // If not open and not embedded, don't render
  if (!isOpen && !embedded) return null;

  // Map component configured to handle scrolling properly
  const mapComponent = (
    <div className={embedded ? "embedded-map-container" : "map-container"}>
      <MapContainer 
        center={defaultPosition} 
        zoom={13} 
        style={{ height: embedded ? '250px' : '400px', width: '100%' }}
        scrollWheelZoom={true}
        wheelDebounceTime={100}
        zoomControl={true}
        attributionControl={true}
        doubleClickZoom={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <LocationMarker position={position} setPosition={setPosition} locationLocked={locationLocked} />
      </MapContainer>
    </div>
  );

  // If embedded in chat, return simplified version
  if (embedded) {
    return (
      <div className="embedded-map-wrapper">
        {mapComponent}
        <div className="embedded-map-footer">
          <div className="coordinates-display">
            {position 
              ? locationLocked 
                ? `Location selected: ${position[0].toFixed(6)}, ${position[1].toFixed(6)}`
                : `Selected: ${position[0].toFixed(6)}, ${position[1].toFixed(6)}`
              : 'Click on the map to select a location'
            }
          </div>
          {!locationLocked && (
            <button 
              className="confirm-button"
              onClick={handleConfirm}
              disabled={!position}
            >
              Confirm Location
            </button>
          )}
        </div>
      </div>
    );
  }

  // Return full modal version
  return (
    <div className="map-modal-overlay">
      <div className="map-modal">
        <div className="map-modal-header">
          <h3>Select a Location</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        {mapComponent}
        <div className="map-modal-footer">
          <p>Click on the map to select a location</p>
          <div className="coordinates-display">
            {position ? `Selected: ${position[0].toFixed(6)}, ${position[1].toFixed(6)}` : 'No location selected'}
          </div>
          <button 
            className="confirm-button"
            onClick={handleConfirm}
            disabled={!position}
          >
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
}

export default MapModal; 