// Menus for the Off-Market Finder and the Outreach section (brief section 14a).
// The same menus serve Propertymaster (developer and investor) and Propertymaster
// Estate Agent. Every outreach item shows its gate in plain words. A gated item is
// visible but disabled while its flag is off.

import { FLAGS } from '../config/flags.js';

export const SECTIONS = ['developer', 'estate_agent'];

// Each item: id, label, optional flag (the gate), and a plain note.
export const OFF_MARKET_MENU = {
  title: 'Off-Market Finder',
  items: [
    { id: 'leads', label: 'Leads', note: 'Your leads from every source, one list.' },
    { id: 'pre_auction', label: 'Pre-auction', note: 'Lots published before the sale, from each house’s own feed or list.' },
    { id: 'probate', label: 'Probate', note: 'Grants are public but carry no address; matched with other public records.', flag: 'OUTREACH_PROBATE_INSOLVENCY' },
    { id: 'insolvency', label: 'Insolvency', note: 'Corporate insolvency notices from The Gazette.', flag: 'OUTREACH_PROBATE_INSOLVENCY' },
    { id: 'repossession', label: 'Repossession', note: 'Ministry of Justice and HMCTS statistics; check the official figure.' },
    { id: 'long_empty', label: 'Long-empty', note: 'Council empty-property data; check each council.' },
    { id: 'network', label: 'Network', note: 'Relationships you already hold. Verify fees and track record before any introduction.' },
    { id: 'alerts', label: 'Alerts', note: 'Notify you when a lead matches your deal rules.' },
  ],
};

export const OUTREACH_MENU = {
  title: 'Outreach',
  items: [
    { id: 'campaigns', label: 'Campaigns', note: 'Plan a campaign. Nothing is sent from here.' },
    { id: 'direct_to_vendor', label: 'Direct to vendor', note: 'Approach an owner directly.', flag: 'OUTREACH_DIRECT_TO_VENDOR', channel: 'direct_to_vendor' },
    { id: 'mail', label: 'Mail', note: 'Letters to owners.', flag: 'OUTREACH_MAIL', channel: 'mail' },
    { id: 'call', label: 'Call', note: 'Telephone calls to owners.', flag: 'OUTREACH_CALL', channel: 'call' },
    { id: 'email', label: 'Email', note: 'Email to owners.', flag: 'OUTREACH_EMAIL', channel: 'email' },
    { id: 'text', label: 'Text', note: 'Text messages to owners.', flag: 'OUTREACH_SMS', channel: 'sms' },
    { id: 'replies', label: 'Replies', note: 'Replies received from owners.' },
    { id: 'opt_outs', label: 'Opt-outs', note: 'People who have asked not to be contacted. Honoured on every channel.' },
    { id: 'suppression', label: 'Suppression lists', note: 'TPS and MPS results and your own do-not-contact lists.' },
    { id: 'consent_log', label: 'Consent log', note: 'Each lawful basis and consent record, with date and source.' },
    { id: 'templates', label: 'Templates', note: 'Message templates. Drafts only; a person approves each message.' },
    { id: 'tracking', label: 'Tracking sheet', note: 'What was drafted, approved and answered.' },
  ],
};

// The gate, in plain words. Returns null for items with no gate.
export function gateText(item) {
  if (!item.flag) {
    return null;
  }
  const flag = FLAGS[item.flag];
  if (!flag) {
    throw new RangeError(`Menu item ${item.id} points to unknown flag ${item.flag}.`);
  }
  return flag.on ? 'On' : `Off: ${flag.gate}`;
}

// The view for one menu in one section. Gated items are visible, disabled while off.
export function menuView(menu, section = 'developer') {
  if (!SECTIONS.includes(section)) {
    throw new RangeError(`Unknown section "${section}". Use one of: ${SECTIONS.join(', ')}.`);
  }
  return {
    section,
    title: menu.title,
    items: menu.items.map((item) => {
      const flag = item.flag ? FLAGS[item.flag] : null;
      const enabled = flag ? flag.on === true : true;
      return {
        id: item.id,
        label: item.label,
        note: item.note,
        flag: item.flag || null,
        enabled,
        visible: true,
        gate: gateText(item),
      };
    }),
  };
}
