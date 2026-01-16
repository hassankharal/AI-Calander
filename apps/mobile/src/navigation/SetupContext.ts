import { createContext, useContext } from 'react';

export const SetupContext = createContext({
  showSetup: () => {},
});

export const useSetup = () => useContext(SetupContext);
