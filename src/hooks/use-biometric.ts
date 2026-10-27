import { useCallback, useEffect, useState } from "react";
import {
  disableBiometric,
  enrollBiometric,
  isBiometricAvailable,
  isBiometricEnabled,
  isBiometricSupported,
  unlockWithBiometric,
} from "@/lib/biometric";

export const BIOMETRIC_CHANGE_EVENT = "hader:biometric-change";

function notifyBiometricChange() {
  window.dispatchEvent(new Event(BIOMETRIC_CHANGE_EVENT));
}

/**
 * Tracks WebAuthn platform-authenticator (biometric) support and the
 * enrollment state, and exposes enroll/unlock/disable actions.
 */
export function useBiometric() {
  const supported = isBiometricSupported();
  // Encode support in the initial state so the effect never has to setState
  // synchronously; when unsupported, both stay false from the first render.
  const [enabled, setEnabled] = useState<boolean | undefined>(
    supported ? undefined : false,
  );
  const [available, setAvailable] = useState(supported);

  const refresh = useCallback(async () => {
    setEnabled(await isBiometricEnabled());
    setAvailable(await isBiometricAvailable());
  }, []);

  useEffect(() => {
    if (!supported) return;
    void (async () => {
      await refresh();
    })();
    window.addEventListener(BIOMETRIC_CHANGE_EVENT, refresh);
    return () => window.removeEventListener(BIOMETRIC_CHANGE_EVENT, refresh);
  }, [supported, refresh]);

  const enroll = useCallback(
    async (displayName: string) => {
      const result = await enrollBiometric(displayName);
      if (result.ok) notifyBiometricChange();
      return result;
    },
    [],
  );

  const unlock = useCallback(() => unlockWithBiometric(), []);

  const disable = useCallback(async () => {
    await disableBiometric();
    notifyBiometricChange();
  }, []);

  return { supported, available, enabled, enroll, unlock, disable };
}
