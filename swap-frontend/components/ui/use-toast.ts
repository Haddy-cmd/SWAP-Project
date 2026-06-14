export function toast({
  title,
  description,
  variant = 'default',
}: {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
} = {}) {
  console.log(`[Toast ${variant}]`, title, description);
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      if (Notification.permission === 'granted') {
        new Notification(title || 'Notification', { body: description });
      }
    } catch (e) {
      console.log('Notification error:', e);
    }
  }
}
