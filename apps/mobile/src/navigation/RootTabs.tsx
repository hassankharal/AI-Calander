import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import CalendarScreen from '../screens/CalendarScreen';
import SchedulerScreen from '../screens/SchedulerScreen';
import TasksScreen from '../screens/TasksScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { colors } from '../theme/tokens';

export type RootTabParamList = {
  Home: undefined;
  Calendar: undefined;
  Scheduler: undefined;
  Tasks: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function RootTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Calendar':
              iconName = focused ? 'calendar' : 'calendar-outline';
              break;
            case 'Scheduler':
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              break;
            case 'Tasks':
              iconName = focused ? 'checkbox' : 'checkbox-outline';
              break;
            case 'Settings':
              iconName = focused ? 'settings' : 'settings-outline';
              break;
            default:
              iconName = 'help-circle-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.obsidian,
          borderTopColor: colors.borderGlass,
          borderTopWidth: 1,
          paddingTop: 12, // Increased spacing
          height: 92, // Taller for premium feel
        },
        tabBarLabelStyle: {
          fontSize: 11, // Improved legibility
          fontWeight: '600',
          paddingBottom: 8,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Scheduler" component={SchedulerScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator >
  );
}
