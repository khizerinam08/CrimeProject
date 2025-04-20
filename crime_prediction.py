import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime

def load_and_preprocess_data():
    # Load the dataset
    print("Loading dataset...")
    df = pd.read_csv('dataset.csv')
    
    # Display basic information about the dataset
    print("\nDataset Info:")
    print(df.info())
    print("\nFirst few rows:")
    print(df.head())
    
    return df

def prepare_features(df):
    print("\nPreparing features...")
    # Convert timestamp to datetime
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    # Extract time-based features
    df['hour'] = df['timestamp'].dt.hour
    df['day_of_week'] = df['timestamp'].dt.dayofweek
    df['month'] = df['timestamp'].dt.month
    
    # Create a binary target variable (1 for crime, 0 for no crime)
    df['crime_occurred'] = 1  # All existing records are crimes
    
    # Prepare features
    features = ['latitude', 'longitude', 'hour', 'day_of_week', 'month']
    X = df[features]
    y = df['crime_occurred']
    
    # Split the data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Scale the features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    return X_train_scaled, X_test_scaled, y_train, y_test, scaler, features

def train_model(X_train, y_train):
    print("\nTraining model...")
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    return model

def evaluate_model(model, X_test, y_test):
    print("\nEvaluating model...")
    y_pred = model.predict(X_test)
    print("Classification Report:")
    print(classification_report(y_test, y_pred))

def predict_crime_probability(model, scaler, latitude, longitude, hour, day_of_week, month):
    # Create input features
    input_features = np.array([[latitude, longitude, hour, day_of_week, month]])
    
    # Scale the features
    input_scaled = scaler.transform(input_features)
    
    # Get probability prediction
    probability = model.predict_proba(input_scaled)[0][1]
    
    return probability

def plot_feature_importance(model, features):
    print("\nPlotting feature importance...")
    feature_importance = pd.DataFrame({
        'feature': features,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    plt.figure(figsize=(10, 6))
    sns.barplot(x='importance', y='feature', data=feature_importance)
    plt.title('Feature Importance')
    plt.show()

def main():
    # Load and preprocess data
    df = load_and_preprocess_data()
    
    # Prepare features
    X_train, X_test, y_train, y_test, scaler, features = prepare_features(df)
    
    # Train model
    model = train_model(X_train, y_train)
    
    # Evaluate model
    evaluate_model(model, X_test, y_test)
    
    # Example prediction
    example_lat = 37.7749  # Example latitude
    example_lon = -122.4194  # Example longitude
    example_hour = 15  # 3 PM
    example_day = 2  # Wednesday
    example_month = 6  # June
    
    probability = predict_crime_probability(model, scaler, example_lat, example_lon, 
                                         example_hour, example_day, example_month)
    print(f"\nExample Prediction:")
    print(f"Location: ({example_lat}, {example_lon})")
    print(f"Time: {example_hour}:00, Day: {example_day}, Month: {example_month}")
    print(f"Predicted crime probability: {probability:.2%}")
    
    # Plot feature importance
    plot_feature_importance(model, features)

if __name__ == "__main__":
    main() 