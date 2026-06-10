import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

function App() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Idle');

  useEffect(() => {
    const unlisten = listen('progress', (event: any) => {
      const { current, total } = event.payload;
      setProgress((current / total) * 100);
      setStatus(`Processing ${current}/${total}`);
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const startBatch = async () => {
    try {
      setStatus('Processing...');
      await invoke('process_photos_command', {
        folderPath: '/path/to/photos',
        presetDto: {
          name: 'Standard',
          aspectRatio: 1.5,
          landscapeFramePath: 'frame_l.png',
          portraitFramePath: 'frame_p.png'
        }
      });
      setStatus('Done!');
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>MagNet</h1>
      <button onClick={startBatch}>Start Batch Processing</button>
      <div>Status: {status}</div>
      <div style={{ width: '100%', background: '#ccc', marginTop: '10px' }}>
        <div style={{ width: `${progress}%`, background: 'green', height: '10px' }}></div>
      </div>
    </div>
  );
}

export default App;
