import { NavigationContainer } from '@react-navigation/native';
import RootTabs from './src/navigation/RootTabs';

export default function App() {
  return (
    <NavigationContainer>
      <RootTabs />
    </NavigationContainer>
  );
}
