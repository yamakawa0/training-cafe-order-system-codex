import { useEffect, useState } from 'react';
import { cafeApi } from '../api/cafeApi';
import { minutes } from '../domain/money';
import type { HallTask } from '../domain/types';

export function HallPage() {
  const [tasks, setTasks] = useState<HallTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');
  const load = () => {
    setError('');
    return cafeApi.hallTasks()
      .then((data) => setTasks(data.tasks))
      .catch((event: Error) => setError(event.message))
      .finally(() => setLoading(false));
  };

  function updateTask(task: HallTask, status: 'doing' | 'done' | 'cancelled') {
    if (busyId) return;
    setBusyId(task.id);
    setError('');
    void cafeApi.hallStatus(task.id, status)
      .then(() => {
        setMessage(`${task.title} を更新しました`);
        return load();
      })
      .catch((event: Error) => setError(event.message))
      .finally(() => setBusyId(''));
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="shell">
      <section className="toolbar">
        <div>
          <p className="eyebrow">カフェ・ルポ / Cafe Repos</p>
          <h1>ホール指示</h1>
        </div>
      </section>
      <section className="taskList">
        {loading && <p className="notice">読み込み中です。</p>}
        {message && <p className="notice">{message}</p>}
        {error && <p className="error">{error}</p>}
        {tasks.length === 0 && !loading && <p className="empty">対応中のホールタスクはありません。</p>}
        {tasks.map((task) => (
          <article className="task" key={task.id}>
            <div>
              <p className="eyebrow">{task.task_type} / {minutes(task.elapsed_seconds)}</p>
              <h2>{task.title}</h2>
              <p>{task.note || task.item_name || '対応してください'}</p>
            </div>
            <span className="status">{task.status}</span>
            <button disabled={task.status !== 'todo' || busyId === task.id} onClick={() => updateTask(task, 'doing')}>開始</button>
            <button className="primary" disabled={busyId === task.id} onClick={() => updateTask(task, 'done')}>完了</button>
            <button disabled={busyId === task.id} onClick={() => updateTask(task, 'cancelled')}>取消</button>
          </article>
        ))}
      </section>
    </main>
  );
}
