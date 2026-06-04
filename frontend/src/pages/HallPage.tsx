import { useEffect, useState } from 'react';
import { cafeApi } from '../api/cafeApi';
import { minutes } from '../domain/money';
import type { HallTask } from '../domain/types';

export function HallPage() {
  const [tasks, setTasks] = useState<HallTask[]>([]);
  const load = () => void cafeApi.hallTasks().then((data) => setTasks(data.tasks));

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="shell">
      <section className="toolbar">
        <div>
          <p className="eyebrow">Hall</p>
          <h1>ホール指示</h1>
        </div>
      </section>
      <section className="taskList">
        {tasks.map((task) => (
          <article className="task" key={task.id}>
            <div>
              <p className="eyebrow">{task.task_type} / {minutes(task.elapsed_seconds)}</p>
              <h2>{task.title}</h2>
              <p>{task.note || task.item_name || '対応してください'}</p>
            </div>
            <span className="status">{task.status}</span>
            <button disabled={task.status !== 'todo'} onClick={() => void cafeApi.hallStatus(task.id, 'doing').then(load)}>開始</button>
            <button className="primary" onClick={() => void cafeApi.hallStatus(task.id, 'done').then(load)}>完了</button>
            <button onClick={() => void cafeApi.hallStatus(task.id, 'cancelled').then(load)}>取消</button>
          </article>
        ))}
      </section>
    </main>
  );
}
