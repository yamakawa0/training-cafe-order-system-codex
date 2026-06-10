import { useEffect, useMemo, useState } from 'react';
import { cafeApi } from '../api/cafeApi';
import { AppHeader, Badge, Banner, EmptyState, SectionTitle, StatusPill } from '../components/ui';
import { minutes } from '../domain/money';
import type { HallTask } from '../domain/types';

const tables = ['T01', 'T02', 'T03', 'T04'];

const taskLabels: Record<HallTask['task_type'], string> = {
  serve_item: '配膳',
  staff_call: 'スタッフ呼び出し',
  checkout_support: '会計サポート',
  clean_table: '片付け'
};

function priorityTone(priority: number) {
  if (priority <= 1) return 'danger';
  if (priority <= 3) return 'warning';
  return 'neutral';
}

function floorStatus(table: string, tasks: HallTask[]) {
  const tableTasks = tasks.filter((task) => task.table_code === table);
  if (tableTasks.some((task) => task.task_type === 'staff_call')) return 'staff_call';
  if (tableTasks.some((task) => task.task_type === 'clean_table')) return 'cleaning';
  if (tableTasks.some((task) => task.task_type === 'checkout_support')) return 'payment_requested';
  if (tableTasks.length > 0) return 'occupied';
  return 'available';
}

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
        setMessage(`${taskLabels[task.task_type]}を更新しました`);
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

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3500);
    return () => window.clearTimeout(timer);
  }, [message]);

  const grouped = useMemo(() => {
    const order: HallTask['task_type'][] = ['staff_call', 'serve_item', 'checkout_support', 'clean_table'];
    return order.map((taskType) => ({
      taskType,
      tasks: tasks.filter((task) => task.task_type === taskType)
    }));
  }, [tasks]);

  return (
    <main className="shell hall">
      <AppHeader
        title="ホール指示"
        subtitle="配膳・片付け・呼び出し"
        meta={<Badge tone={tasks.some((task) => task.task_type === 'staff_call') ? 'danger' : 'info'}>対応中 {tasks.length} 件</Badge>}
      />
      {loading && <Banner>ホールタスクを読み込み中です。</Banner>}
      {message && <Banner tone="success">{message}</Banner>}
      {error && <Banner tone="danger">{error}</Banner>}
      <section className="hallGrid">
        <aside className="panel floorPanel">
          <SectionTitle title="フロア" subtitle="席状態" />
          <div className="floorMap">
            {tables.map((table) => {
              const status = floorStatus(table, tasks);
              return (
                <article className={`tableTile ${status}`} key={table}>
                  <strong>{table}</strong>
                  <span>{status}</span>
                </article>
              );
            })}
          </div>
        </aside>
        <section className="taskBoard">
          {tasks.length === 0 && !loading && <EmptyState>対応中のホールタスクはありません。</EmptyState>}
          {grouped.map((group) => (
            <section className="taskGroup" key={group.taskType}>
              <SectionTitle title={`${taskLabels[group.taskType]} (${group.tasks.length})`} />
              <div className="taskList">
                {group.tasks.length === 0 && !loading && <EmptyState>対象タスクはありません</EmptyState>}
                {group.tasks.map((task) => (
                  <article className={`taskCard ${task.task_type} status-${task.status}`} key={task.id}>
                    <header>
                      <div>
                        <Badge tone={task.task_type === 'staff_call' ? 'danger' : 'info'}>{taskLabels[task.task_type]}</Badge>
                        <strong>{task.table_code}</strong>
                      </div>
                      <StatusPill status={task.status} />
                    </header>
                    <h3>{task.title}</h3>
                    <p>{task.note || task.item_name || '対応してください'}{task.quantity ? ` x ${task.quantity}` : ''}</p>
                    <div className="badgeRow">
                      <Badge tone={priorityTone(task.priority)}>優先度 {task.priority}</Badge>
                      <Badge>{minutes(task.elapsed_seconds)}</Badge>
                    </div>
                    <footer>
                      <button disabled={task.status !== 'todo' || busyId === task.id} onClick={() => updateTask(task, 'doing')}>対応開始</button>
                      <button className="primary" disabled={busyId === task.id} onClick={() => updateTask(task, 'done')}>完了</button>
                      <button className="dangerButton" disabled={busyId === task.id} onClick={() => updateTask(task, 'cancelled')}>取消</button>
                    </footer>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </section>
      </section>
    </main>
  );
}
