import { useEffect, useState } from 'react';
import {
  loadWebLLM,
  unloadWebLLM,
  subscribeWebLLM,
  WebLLMStatus,
} from '../lib/webllm';

export function useWebLLM() {
  const [status, setStatus]     = useState<WebLLMStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const unsub = subscribeWebLLM((s, p, e) => {
      setStatus(s);
      setProgress(p);
      setErrorMsg(e);
    });
    return unsub;
  }, []);

  const load = async () => {
    try { await loadWebLLM(); }
    catch { /* error already broadcast via subscription */ }
  };

  return { status, progress, errorMsg, load, unload: unloadWebLLM };
}
