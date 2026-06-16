import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform, View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors } from './src/theme/colors';
import HomeScreen from './src/screens/HomeScreen';
import ConfigScreen from './src/screens/ConfigScreen';
import SetupScreen from './src/screens/SetupScreen';
import OrderScreen from './src/screens/OrderScreen';
import NightScreen from './src/screens/NightScreen';
import ResultScreen from './src/screens/ResultScreen';
import DayScreen from './src/screens/DayScreen';

export type RootStackParamList = {
  Home: undefined;
  Config: undefined;
  Setup: undefined;
  Order: undefined;
  Night: undefined;
  Result: undefined;
  Day: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const isWeb = Platform.OS === 'web';

export default function App() {
  return (
    // 在瀏覽器上模擬手機直式畫面（390px 寬）
    <GestureHandlerRootView style={styles.outer}>
      <View style={[styles.inner, isWeb && styles.innerWeb]}>
        <NavigationContainer>
          <StatusBar style="light" />
          <Stack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: Colors.surface },
              headerTintColor: Colors.text,
              headerTitleStyle: { fontWeight: 'bold' },
              contentStyle: { backgroundColor: Colors.background },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: '🐺 狼人殺主持' }} />
            <Stack.Screen name="Config" component={ConfigScreen} options={{ title: '選擇配置' }} />
            <Stack.Screen name="Setup" component={SetupScreen} options={{ title: '腳色設定' }} />
            <Stack.Screen name="Order" component={OrderScreen} options={{ title: '夜晚順序調整' }} />
            <Stack.Screen name="Night" component={NightScreen} options={{ headerBackVisible: false }} />
            <Stack.Screen name="Result" component={ResultScreen} options={{ headerBackVisible: false }} />
            <Stack.Screen name="Day" component={DayScreen} options={{ headerBackVisible: false }} />
          </Stack.Navigator>
        </NavigationContainer>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: isWeb ? '#0d0d0d' : Colors.background,
    alignItems: 'center',
    // 網頁版：鎖定高度為視窗高，防止整頁跟著內容撐高
    ...(isWeb && { height: '100vh' as any, overflow: 'hidden' as any }),
  },
  inner: {
    flex: 1,
    width: '100%',
    overflow: 'hidden' as any,
  },
  innerWeb: {
    width: 390,
  },
});
