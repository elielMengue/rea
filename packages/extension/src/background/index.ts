import { collectGarbage } from '../storage';

const GC_ALARM = 'reader-mode:gc';
const GC_PERIOD_MINUTES = 6 * 60;

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(GC_ALARM, { periodInMinutes: GC_PERIOD_MINUTES });
  void collectGarbage();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === GC_ALARM) void collectGarbage();
});
