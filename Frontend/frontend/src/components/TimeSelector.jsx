import { useState } from 'react';

function TimeSelector({ isOpen, onClose, onSelectTimeDay }) {
  const [hour, setHour] = useState(12);
  const [minute, setMinute] = useState(0);
  const [period, setPeriod] = useState('pm');
  const [day, setDay] = useState(0); // 0 = Monday

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  const handleConfirm = () => {
    // Convert to 24-hour format for the API
    let hour24 = hour;
    if (period === 'pm' && hour < 12) hour24 += 12;
    if (period === 'am' && hour === 12) hour24 = 0;
    
    onSelectTimeDay({
      hour: hour24,
      minute,
      day,
      // Also provide formatted display values
      displayTime: `${hour}:${minute.toString().padStart(2, '0')} ${period}`,
      displayDay: days[day]
    });
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="time-modal-overlay">
      <div className="time-modal">
        <div className="time-modal-header">
          <h3>Select Time and Day</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="time-selector-container">
          <div className="time-inputs">
            <div className="input-group">
              <label>Hour:</label>
              <select 
                value={hour} 
                onChange={(e) => setHour(parseInt(e.target.value))}
              >
                {hours.map(h => (
                  <option key={`hour-${h}`} value={h}>{h}</option>
                ))}
              </select>
            </div>
            
            <div className="input-group">
              <label>Minute:</label>
              <select 
                value={minute} 
                onChange={(e) => setMinute(parseInt(e.target.value))}
              >
                {minutes.map(m => (
                  <option key={`minute-${m}`} value={m}>{m.toString().padStart(2, '0')}</option>
                ))}
              </select>
            </div>
            
            <div className="input-group">
              <label>AM/PM:</label>
              <select 
                value={period} 
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option value="am">AM</option>
                <option value="pm">PM</option>
              </select>
            </div>
          </div>
          
          <div className="day-selector">
            <label>Day of Week:</label>
            <div className="day-buttons">
              {days.map((dayName, index) => (
                <button
                  key={dayName}
                  className={`day-button ${day === index ? 'active' : ''}`}
                  onClick={() => setDay(index)}
                >
                  {dayName.substring(0, 3)}
                </button>
              ))}
            </div>
          </div>
          
          <div className="selected-time-display">
            Selected: {hour}:{minute.toString().padStart(2, '0')} {period} on {days[day]}
          </div>
        </div>
        
        <div className="time-modal-footer">
          <button className="confirm-button" onClick={handleConfirm}>
            Confirm Time & Day
          </button>
        </div>
      </div>
    </div>
  );
}

export default TimeSelector; 