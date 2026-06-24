import React from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

// Wrapper interno que detecta cualquier toque y reinicia el timer de inactividad.
// onTouchStart en un View padre se dispara antes de que cualquier hijo reclame
// el responder, sin interferir con la interacción normal de la app.
function InactivityLayer({ children }) {
  const { resetTimer, token } = useAuth();
  return (
    <View style={{ flex: 1 }} onTouchStart={() => { if (token) resetTimer(); }}>
      {children}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <InactivityLayer>
            <RootNavigator />
          </InactivityLayer>
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
