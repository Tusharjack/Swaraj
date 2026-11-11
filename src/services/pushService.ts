/**
 * Device push notifications (FCM / APNs) via Capacitor.
 *
 * In-app notification records are created by database triggers and shown by
 * the NotificationCentre — this file is ONLY responsible for delivering an
 * actual OS-level push to the device.
 *
 * The Capacitor plugin is loaded dynamically so the web build keeps working
 * when the native plugin is not installed. To enable device push:
 *   1. npm install @capacitor/push-notifications
 *   2. npx cap sync android   (and/or ios)
 *   3. The Edge Function "push-notify" sends the FCM/APNs message.
 */

let registeredToken: string | null = null;

async function loadPlugin(): Promise<any | null> {
  try {
    // Variable name keeps Vite from hard-resolving the optional dependency.
    const pkg = '@capacitor/push-notifications';
    return await import(/* @vite-ignore */ pkg);
  } catch {
    return null;
  }
}

export const pushService = {
  get token() { return registeredToken; },

  /**
   * Request permission and register for push. Safe to call on web — it is a
   * no-op when the native plugin is unavailable. Returns the device token or
   * null. Store the token against the user so the Edge Function can target it.
   */
  async register(): Promise<string | null> {
    const mod = await loadPlugin();
    if (!mod?.PushNotifications) return null;

    const { PushNotifications } = mod;

    const perm = await PushNotifications.checkPermissions().catch(() => null);
    let receive = perm?.receive;
    if (receive !== 'granted') {
      const req = await PushNotifications.requestPermissions();
      receive = req.receive;
    }
    if (receive !== 'granted') return null;

    return new Promise<string | null>((resolve) => {
      PushNotifications.addListener('registration', (t: { value: string }) => {
        registeredToken = t.value;
        resolve(t.value);
      });
      PushNotifications.addListener('registrationError', () => resolve(null));

      // Foreground presentation (Android shows a heads-up notification).
      PushNotifications.addListener('pushNotificationReceived', () => {});

      // Tapping a notification opens the app — deep-link handling can be
      // added here (e.g. navigate to n.data.link_url).
      PushNotifications.addListener('pushNotificationActionPerformed', () => {});

      PushNotifications.register();
    });
  },
};
