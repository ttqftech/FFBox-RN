import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { setDashboardTimerPaused } from '../common/dashboardCalc';

export default function RootLayout() {
  // 节能：切后台暂停 dashboard timer，回前台恢复
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      setDashboardTimerPaused(s !== 'active');
    });
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(index)/index" />
          <Stack.Screen name="main/index" />
          <Stack.Screen name="upload/index" />
          <Stack.Screen name="preset/index" />
          <Stack.Screen name="preset-edit/index" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
