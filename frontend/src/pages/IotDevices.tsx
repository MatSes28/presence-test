import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  queryKeys,
  fetchIotDevices,
  createIotDevice,
  updateIotDevice,
  deleteIotDevice,
  type IoTDevice,
} from '../api/queries';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

export default function IotDevices() {
  const queryClient = useQueryClient();
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);

  const { data: devices = [], isLoading } = useQuery({
    queryKey: queryKeys.iotDevices,
    queryFn: fetchIotDevices,
  });

  const createMutation = useMutation({
    mutationFn: (body: { device_id: string; name?: string }) => createIotDevice(body),
    onSuccess: (data) => {
      setCreatedApiKey(data.api_key);
      setNewDeviceId('');
      setNewDeviceName('');
      queryClient.invalidateQueries({ queryKey: queryKeys.iotDevices });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; is_active?: boolean } }) =>
      updateIotDevice(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.iotDevices }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteIotDevice,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.iotDevices }),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newDeviceId.trim()) return;
    createMutation.mutate({ device_id: newDeviceId.trim(), name: newDeviceName.trim() || undefined });
  }

  function toggleActive(device: IoTDevice) {
    updateMutation.mutate({ id: device.id, body: { is_active: !device.is_active } });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text)] tracking-tight">IoT devices</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Register ESP32 devices for attendance. Use the returned API key on the device. Last seen is updated on each attendance event.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Register device</CardTitle>
          <CardDescription>Add a new device. The API key is shown once — store it on the ESP32.</CardDescription>
        </CardHeader>
        <CardContent>
          {createdApiKey && (
            <div className="mb-4 p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
              <p className="text-sm text-[var(--text-muted)] mb-1">API key (copy now):</p>
              <code className="text-sm break-all text-[var(--accent)]">{createdApiKey}</code>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={() => setCreatedApiKey(null)}
              >
                Done
              </Button>
            </div>
          )}
          <form onSubmit={handleCreate} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-sm text-[var(--text-muted)] mb-1">Device ID</label>
              <Input
                placeholder="e.g. esp32-room-a1"
                value={newDeviceId}
                onChange={(e) => setNewDeviceId(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-sm text-[var(--text-muted)] mb-1">Name (optional)</label>
              <Input
                placeholder="Room A1 reader"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={createMutation.isPending || !newDeviceId.trim()}>
              {createMutation.isPending ? 'Adding…' : 'Add device'}
            </Button>
          </form>
          {createMutation.isError && (
            <p className="mt-2 text-sm text-[var(--error)]">
              {createMutation.error instanceof Error ? createMutation.error.message : 'Failed to add device'}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Devices</CardTitle>
          <CardDescription>Registered ESP32 devices and last seen time.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-[var(--text-muted)]">Loading…</p>
          ) : devices.length === 0 ? (
            <p className="text-[var(--text-muted)]">No devices registered yet.</p>
          ) : (
            <ul className="space-y-2">
              {devices.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-sm">{d.device_id}</span>
                    {d.name && <span className="text-[var(--text-muted)] ml-2 text-sm">— {d.name}</span>}
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">
                    Last seen: {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : 'Never'}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${d.is_active ? 'bg-[var(--success)]/20 text-[var(--success)]' : 'bg-[var(--text-muted)]/20 text-[var(--text-muted)]'}`}
                  >
                    {d.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => toggleActive(d)}
                    disabled={updateMutation.isPending}
                  >
                    {d.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteMutation.mutate(d.id)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
