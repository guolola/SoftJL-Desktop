// Reopens the persistent provider setup alert from either modeling workflow.
export const PROVIDER_REQUIRED_NOTICE_EVENT = "uml-provider-required-notice";

export function requestProviderRequiredNotice() {
  window.dispatchEvent(new Event(PROVIDER_REQUIRED_NOTICE_EVENT));
}
