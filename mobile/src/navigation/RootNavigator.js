import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext';

// Auth screens
import WelcomeScreen        from '../screens/WelcomeScreen';
import LoginScreen          from '../screens/LoginScreen';
import RegisterScreen       from '../screens/RegisterScreen';

// App screens
import HomeScreen           from '../screens/HomeScreen';
import NewReportStep1Screen from '../screens/NewReportStep1Screen';
import NewReportStep2Screen from '../screens/NewReportStep2Screen';
import NewReportStep3Screen from '../screens/NewReportStep3Screen';
import ReportSuccessScreen  from '../screens/ReportSuccessScreen';
import MyReportsScreen      from '../screens/MyReportsScreen';
import ReportDetailScreen   from '../screens/ReportDetailScreen';
import ProfileScreen           from '../screens/ProfileScreen';
import NotificationsScreen    from '../screens/NotificationsScreen';
import HeatmapScreen          from '../screens/HeatmapScreen';

const Stack = createNativeStackNavigator();

// Sin header nativo — cada pantalla tiene el suyo propio
const screenOptions = { headerShown: false, animation: 'slide_from_right' };

export default function RootNavigator() {
  const { user, loading } = useAuth();

  // Splash mientras AsyncStorage restaura la sesión
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1B2A4A' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {user ? (
        // ── Screens autenticadas ───────────────────────────────────────────
        <>
          <Stack.Screen name="Home"           component={HomeScreen} />
          <Stack.Screen name="NewReportStep1" component={NewReportStep1Screen} />
          <Stack.Screen name="NewReportStep2" component={NewReportStep2Screen} />
          <Stack.Screen name="NewReportStep3" component={NewReportStep3Screen} />
          <Stack.Screen name="ReportSuccess"  component={ReportSuccessScreen} />
          <Stack.Screen name="MyReports"      component={MyReportsScreen} />
          <Stack.Screen name="ReportDetail"   component={ReportDetailScreen} />
          <Stack.Screen name="Profile"        component={ProfileScreen} />
          <Stack.Screen name="Notifications"  component={NotificationsScreen} />
          <Stack.Screen name="Heatmap"        component={HeatmapScreen} />
        </>
      ) : (
        // ── Screens de auth ────────────────────────────────────────────────
        <>
          <Stack.Screen name="Welcome"  component={WelcomeScreen} />
          <Stack.Screen name="Login"    component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
