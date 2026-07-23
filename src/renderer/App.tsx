import React, { Suspense } from 'react';
import { useProjectStore } from './stores/useProjectStore';
import { useFileStore } from './stores/useFileStore';
import { FolderPicker, saveRecentProject } from './components/onboarding/FolderPicker';

const AppMain = React.lazy(() => import('./AppMain'));

export default function App() {
  const { projectPath, hasCompletedOnboarding, setProjectPath, completeOnboarding } =
    useProjectStore();

  const handleFolderSelected = (folderPath: string) => {
    saveRecentProject(folderPath);
    setProjectPath(folderPath);
    completeOnboarding();
    useFileStore.getState().setCurrentPath(folderPath);
  };

  if (!hasCompletedOnboarding || !projectPath) {
    return <FolderPicker onSelect={handleFolderSelected} />;
  }

  return (
    <Suspense fallback={<div className="h-full w-full bg-bg-deepest" />}>
      <AppMain />
    </Suspense>
  );
}
