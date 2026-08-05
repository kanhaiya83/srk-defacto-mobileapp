import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';

import { useTheme } from '@/theme';

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.faintText,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.border,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inward"
        options={{
          title: 'Inward',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'download' : 'download-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="outward"
        options={{
          title: 'Outward',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'cloud-upload' : 'cloud-upload-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="masters"
        options={{
          title: 'Masters',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal-circle-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
