import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { checkJava, isJarDownloaded, renderPlantUml, downloadJar } from '../services/plantuml-service';

export function registerPlantumlIpc() {
  ipcMain.handle(IPC.PLANTUML_CHECK, async () => {
    const java = await checkJava();
    return {
      javaAvailable: java.available,
      javaVersion: java.version,
      jarDownloaded: isJarDownloaded(),
      error: java.error || null,
    };
  });

  ipcMain.handle(IPC.PLANTUML_RENDER, async (_event, content: string) => {
    try {
      const svg = await renderPlantUml(content);
      return { success: true, svg };
    } catch (err: any) {
      return { success: false, error: err.message || '渲染失败' };
    }
  });
}
