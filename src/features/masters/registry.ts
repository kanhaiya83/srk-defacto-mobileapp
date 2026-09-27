import type { Ionicons } from '@expo/vector-icons';

import type { RecordField } from '@/components/record-card';
import type { BadgeTone } from '@/components/ui/badge';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { STATE_NAME_OPTIONS, toStateName } from '@/lib/states';

/**
 * Master-data registry.
 *
 * Fifteen master screens differ only in their fields, so they are described
 * here as data and rendered by one list screen and one form screen. Adding a
 * master is a config entry, not a new screen — and every master then behaves
 * identically: same search, same validation placement, same delete guard.
 */

/** A master other masters point at. Each key is also that master's route and permission module. */
export type ReferenceSource = 'commodity' | 'company' | 'bag-type' | 'bag-grade' | 'vendor';

/** Resolves a stored reference id to its display name, once the source has loaded. */
export type ReferenceNames = (source: ReferenceSource, id: unknown) => string | undefined;

type Item = Record<string, unknown>;

export interface MasterSubField {
  key: string;
  label: string;
  type?: 'text' | 'phone' | 'email';
  /** Every kept row must fill this in. */
  required?: boolean;
}

export interface MasterField {
  key: string;
  label: string;
  type:
    | 'text'
    | 'number'
    | 'email'
    | 'phone'
    | 'textarea'
    | 'date'
    | 'reference'
    | 'reference-multi'
    | 'options'
    | 'string-list'
    | 'object-list';
  /** For `object-list`, at least one filled-in row. */
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** Where a `reference*` field's options come from. */
  source?: ReferenceSource;
  /**
   * A `reference-multi` value may belong to only one record of this master
   * (a company sits in one group). Values taken by other records are disabled.
   */
  exclusive?: boolean;
  /** Fixed choices for an `options` field. */
  options?: { label: string; value: string }[];
  /** `options` accepts more than one value. */
  multiple?: boolean;
  /** Sub-fields of an `object-list` row. */
  itemFields?: MasterSubField[];
  /** Row label for list fields, e.g. "Contact". */
  itemLabel?: string;
  /**
   * `object-list` rows carry a stable id under this key, generated for new
   * rows. Other records point at the row by it (stock sits in a sub-location).
   */
  rowId?: string;
  /** Field is shown but never sent — server-derived. */
  readOnly?: boolean;
  suffix?: string;
  /** Normalises a stored value when a record is opened for editing. */
  load?: (value: unknown) => unknown;
  /** On a new record, recomputed whenever the named field changes (e.g. slug from name). */
  derive?: { from: string; compute: (value: unknown) => unknown };
}

export interface MasterConfig {
  /** Route segment and permission module key. */
  key: string;
  title: string;
  singular: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  /** React Query key + REST collection, as used by `masters-api`. */
  resource: string;
  /** Other masters whose names the list shows. Each is fetched only if the role may read it. */
  uses?: ReferenceSource[];
  primary: (item: Item, names: ReferenceNames) => string;
  secondary?: (item: Item, names: ReferenceNames) => string | undefined;
  cardFields?: (item: Item, names: ReferenceNames) => RecordField[];
  badge?: (item: Item) => { label: string; tone?: BadgeTone } | undefined;
  search: (item: Item, names: ReferenceNames) => unknown[];
  /** Filter chips over one reference field — the web groups these lists by it. */
  groupBy?: { key: string; source: ReferenceSource };
  fields: MasterField[];
  /** Records can be edited but not created or deleted (Item Rates). */
  editOnly?: boolean;
}

const str = (value: unknown) => (value === null || value === undefined ? '' : String(value));
const list = <T = unknown>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** "Shree Ram Krishna Traders" → "SRKT", as the web client suggests it. */
const slugFromName = (value: unknown) =>
  str(value)
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');

export const MASTER_CONFIGS: Record<string, MasterConfig> = {
  // ------------------------------------------------------------------ agent
  agent: {
    key: 'agent',
    title: 'Agents',
    singular: 'Agent',
    icon: 'people-outline',
    description: 'Brokers and their bank details',
    resource: 'agents',
    primary: (item) => str(item.agent_name),
    secondary: (item) => str(item.mobile_no) || undefined,
    cardFields: (item) => [
      { label: 'Email', value: str(item.email) },
      { label: 'PAN', value: str(item.pan_no) },
      { label: 'Bank', value: str(item.bank_name) },
      { label: 'Account', value: str(item.account_no) },
    ],
    search: (item) => [item.agent_name, item.mobile_no, item.email, item.pan_no, item.bank_name, item.office_address],
    fields: [
      { key: 'agent_name', label: 'Agent name', type: 'text', required: true },
      { key: 'mobile_no', label: 'Mobile no', type: 'phone', required: true },
      { key: 'phone_no', label: 'Phone no', type: 'phone' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'office_address', label: 'Office address', type: 'textarea' },
      { key: 'aadhaar_no', label: 'Aadhaar no', type: 'text' },
      { key: 'pan_no', label: 'PAN no', type: 'text' },
      { key: 'bank_name', label: 'Bank name', type: 'text' },
      { key: 'account_no', label: 'Account no', type: 'text' },
      { key: 'branch', label: 'Branch', type: 'text' },
      { key: 'ifsc_code', label: 'IFSC code', type: 'text' },
    ],
  },

  // -------------------------------------------------------------- commodity
  commodity: {
    key: 'commodity',
    title: 'Commodities',
    singular: 'Commodity',
    icon: 'leaf-outline',
    description: 'What the business trades in',
    resource: 'commodities',
    primary: (item) => str(item.commodity_name),
    search: (item) => [item.commodity_name],
    fields: [{ key: 'commodity_name', label: 'Commodity name', type: 'text', required: true }],
  },

  // ------------------------------------------------------------------ grade
  grade: {
    key: 'grade',
    title: 'Grades',
    singular: 'Grade',
    icon: 'bar-chart-outline',
    description: 'Quality grades, one commodity each',
    resource: 'grades',
    uses: ['commodity'],
    groupBy: { key: 'commodity_id', source: 'commodity' },
    primary: (item) => str(item.grade_name),
    secondary: (item, names) => names('commodity', item.commodity_id),
    cardFields: (item) => [{ label: 'Rate', value: item.rate ? formatCurrency(Number(item.rate)) : null }],
    search: (item, names) => [item.grade_name, names('commodity', item.commodity_id)],
    fields: [
      { key: 'grade_name', label: 'Grade name', type: 'text', required: true },
      { key: 'commodity_id', label: 'Commodity', type: 'reference', source: 'commodity', required: true },
    ],
  },

  // ------------------------------------------------------------- item rates
  'item-rates': {
    key: 'item-rates',
    title: 'Item Rates',
    singular: 'Rate',
    icon: 'cash-outline',
    description: 'The rate carried by each grade',
    resource: 'grades',
    uses: ['commodity'],
    groupBy: { key: 'commodity_id', source: 'commodity' },
    editOnly: true,
    primary: (item) => str(item.grade_name),
    secondary: (item, names) => names('commodity', item.commodity_id),
    cardFields: (item) => [
      { label: 'Rate', value: item.rate ? formatCurrency(Number(item.rate)) : 'Not set', emphasis: Boolean(item.rate) },
    ],
    search: (item, names) => [item.grade_name, names('commodity', item.commodity_id)],
    fields: [
      { key: 'grade_name', label: 'Grade', type: 'text', readOnly: true },
      { key: 'rate', label: 'Rate', type: 'number', suffix: '₹' },
    ],
  },

  // ------------------------------------------------------------ weigh bridge
  'weigh-bridge': {
    key: 'weigh-bridge',
    title: 'Weigh Bridges',
    singular: 'Weigh Bridge',
    icon: 'speedometer-outline',
    description: 'Weighing stations goods pass over',
    resource: 'weigh-bridges',
    primary: (item) => str(item.name),
    search: (item) => [item.name],
    fields: [{ key: 'name', label: 'Weigh bridge name', type: 'text', required: true }],
  },

  // --------------------------------------------------------------- bag type
  'bag-type': {
    key: 'bag-type',
    title: 'Bag Types',
    singular: 'Bag Type',
    icon: 'cube-outline',
    description: 'Packaging types goods arrive in',
    resource: 'bag-types',
    primary: (item) => str(item.bag_type_name),
    search: (item) => [item.bag_type_name],
    fields: [{ key: 'bag_type_name', label: 'Bag type name', type: 'text', required: true }],
  },

  // -------------------------------------------------------------- bag grade
  'bag-grade': {
    key: 'bag-grade',
    title: 'Bag Grades',
    singular: 'Bag Grade',
    icon: 'layers-outline',
    description: 'Quality tiers a bag type can have',
    resource: 'bag-grades',
    primary: (item) => str(item.title),
    search: (item) => [item.title],
    fields: [{ key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'e.g. A grade' }],
  },

  // ------------------------------------------------------- bag type config
  'bag-type-config': {
    key: 'bag-type-config',
    title: 'Bag Type Config',
    singular: 'Bag Config',
    icon: 'options-outline',
    description: 'Size and tare weight per bag type and grade',
    resource: 'bag-type-configurations',
    uses: ['bag-type', 'bag-grade'],
    primary: (item, names) => names('bag-type', item.bag_type_id) ?? 'Bag type',
    secondary: (item, names) => names('bag-grade', item.bag_grade_id),
    cardFields: (item) => [
      { label: 'Size', value: `${formatNumber(Number(item.bag_size_kg))} kg`, emphasis: true },
      { label: 'Tare weight', value: `${formatNumber(Number(item.bag_weight), 2)} kg` },
    ],
    search: (item, names) => [
      names('bag-type', item.bag_type_id),
      names('bag-grade', item.bag_grade_id),
      item.bag_size_kg,
      item.bag_weight,
    ],
    fields: [
      { key: 'bag_type_id', label: 'Bag type', type: 'reference', source: 'bag-type', required: true },
      { key: 'bag_grade_id', label: 'Bag grade', type: 'reference', source: 'bag-grade', required: true },
      { key: 'bag_size_kg', label: 'Bag size', type: 'number', suffix: 'kg', required: true },
      { key: 'bag_weight', label: 'Bag weight (tare)', type: 'number', suffix: 'kg', required: true },
    ],
  },

  // ---------------------------------------------------------------- company
  company: {
    key: 'company',
    title: 'Companies',
    singular: 'Company',
    icon: 'business-outline',
    description: 'Legal entities that raise and receive bills',
    resource: 'companies',
    primary: (item) => str(item.company_name),
    secondary: (item) => [str(item.slug), str(item.gst_no)].filter(Boolean).join(' · ') || undefined,
    cardFields: (item) => [
      { label: 'Mobile', value: list<string>(item.mobile_no).join(', ') },
      { label: 'Email', value: str(item.email) },
      { label: 'Challan', value: `${str(item.challan_prefix)}${str(item.challan_series)}` },
      { label: 'Established', value: item.date_of_establishment ? formatDate(String(item.date_of_establishment)) : null },
    ],
    search: (item) => [item.company_name, item.gst_no, item.pan_no, item.email, item.slug, item.office_address],
    fields: [
      { key: 'company_name', label: 'Company name', type: 'text', required: true },
      {
        key: 'slug',
        label: 'Slug',
        type: 'text',
        required: true,
        hint: 'Short code used on documents — filled in from the name',
        derive: { from: 'company_name', compute: slugFromName },
      },
      { key: 'office_address', label: 'Office address', type: 'textarea', required: true },
      { key: 'factory_address', label: 'Factory address', type: 'textarea' },
      { key: 'gst_no', label: 'GST no', type: 'text' },
      { key: 'pan_no', label: 'PAN no', type: 'text' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'mobile_no', label: 'Mobile numbers', type: 'string-list', itemLabel: 'Mobile' },
      { key: 'challan_prefix', label: 'Challan prefix', type: 'text' },
      { key: 'challan_series', label: 'Challan series', type: 'number' },
      { key: 'date_of_establishment', label: 'Date of establishment', type: 'date' },
      { key: 'bank_name', label: 'Bank name', type: 'text' },
      { key: 'bank_account_no', label: 'Bank account no', type: 'text' },
      { key: 'bank_branch', label: 'Bank branch', type: 'text' },
      { key: 'ifsc_code', label: 'IFSC code', type: 'text' },
    ],
  },

  // ---------------------------------------------------------- company group
  'company-group': {
    key: 'company-group',
    title: 'Company Groups',
    singular: 'Company Group',
    icon: 'git-merge-outline',
    description: 'Stock is held against a group, not a single company',
    resource: 'company-groups',
    uses: ['company'],
    primary: (item) => str(item.group_name),
    secondary: (item, names) => {
      const ids = list(item.company_ids);
      const known = ids.map((id) => names('company', id)).filter(Boolean);
      return known.length ? known.join(', ') : `${ids.length} companies`;
    },
    search: (item, names) => [item.group_name, ...list(item.company_ids).map((id) => names('company', id))],
    fields: [
      { key: 'group_name', label: 'Group name', type: 'text', required: true },
      {
        key: 'company_ids',
        label: 'Companies',
        type: 'reference-multi',
        source: 'company',
        required: true,
        exclusive: true,
        hint: 'A company can belong to only one group',
      },
    ],
  },

  // ---------------------------------------------------------------- machine
  machine: {
    key: 'machine',
    title: 'Machines',
    singular: 'Machine',
    icon: 'cog-outline',
    description: 'Processing machines a lot can run on',
    resource: 'machines',
    primary: (item) => str(item.machine_name),
    secondary: (item) => str(item.remark) || undefined,
    // The server populates the lot a machine is running, so its number is at hand.
    badge: (item) => {
      const lot = item.locked_in_lot as { lot_no?: unknown } | string | null | undefined;
      if (!lot) return { label: 'Available', tone: 'success' };
      const lotNo = typeof lot === 'object' ? lot.lot_no : undefined;
      return { label: lotNo ? `In lot #${str(lotNo)}` : 'In a lot', tone: 'warning' };
    },
    search: (item) => [item.machine_name, item.remark],
    fields: [
      { key: 'machine_name', label: 'Machine name', type: 'text', required: true },
      { key: 'remark', label: 'Remark', type: 'text' },
    ],
  },

  // -------------------------------------------------------- source location
  'source-location': {
    key: 'source-location',
    title: 'Source Locations',
    singular: 'Source Location',
    icon: 'location-outline',
    description: 'Where inbound goods come from',
    resource: 'source-locations',
    primary: (item) => str(item.source_location_name),
    search: (item) => [item.source_location_name],
    fields: [{ key: 'source_location_name', label: 'Location name', type: 'text', required: true }],
  },

  // ----------------------------------------------------------------- vendor
  vendor: {
    key: 'vendor',
    title: 'Vendors',
    singular: 'Vendor',
    icon: 'person-circle-outline',
    description: 'Buyers and sellers you trade with',
    resource: 'vendors',
    primary: (item) => str(item.vendor_name),
    secondary: (item) => list<string>(item.category).map(capitalize).join(' · ') || undefined,
    cardFields: (item) => {
      const contact = list<{ person?: string; mobile_no?: string }>(item.contact_details)[0];
      return [
        { label: 'Contact', value: contact ? [contact.person, contact.mobile_no].filter(Boolean).join(' · ') : null },
        { label: 'State', value: toStateName(item.state) },
        { label: 'GST', value: str(item.gst_no) },
        { label: 'Landline', value: str(item.landline_no) },
      ];
    },
    search: (item) => [
      item.vendor_name,
      item.gst_no,
      item.pan_no,
      toStateName(item.state),
      ...list<{ person?: string; mobile_no?: string }>(item.contact_details).flatMap((c) => [c.person, c.mobile_no]),
    ],
    fields: [
      {
        key: 'category',
        label: 'Category',
        type: 'options',
        multiple: true,
        required: true,
        options: [
          { label: 'Seller', value: 'seller' },
          { label: 'Buyer', value: 'buyer' },
        ],
      },
      { key: 'vendor_name', label: 'Vendor name', type: 'text', required: true },
      { key: 'state', label: 'State', type: 'options', required: true, options: STATE_NAME_OPTIONS, load: toStateName },
      { key: 'pan_no', label: 'PAN no', type: 'text' },
      { key: 'gst_no', label: 'GST no', type: 'text' },
      { key: 'landline_no', label: 'Landline no', type: 'phone' },
      { key: 'office_address', label: 'Office address', type: 'textarea' },
      { key: 'factory_address', label: 'Factory address', type: 'textarea' },
      { key: 'email', label: 'Emails', type: 'string-list', itemLabel: 'Email' },
      {
        key: 'contact_details',
        label: 'Contacts',
        type: 'object-list',
        itemLabel: 'Contact',
        itemFields: [
          { key: 'person', label: 'Person' },
          { key: 'mobile_no', label: 'Mobile no', type: 'phone' },
        ],
      },
      {
        key: 'other_addresses',
        label: 'Other addresses',
        type: 'object-list',
        itemLabel: 'Address',
        itemFields: [
          { key: 'label', label: 'Label (e.g. Warehouse)' },
          { key: 'address', label: 'Address' },
        ],
      },
    ],
  },

  // ------------------------------------------------------------ vendor bank
  'vendor-bank': {
    key: 'vendor-bank',
    title: 'Vendor Banks',
    singular: 'Vendor Bank',
    icon: 'card-outline',
    description: 'Bank accounts held per vendor',
    resource: 'vendor-bank-details',
    uses: ['vendor'],
    primary: (item, names) => names('vendor', item.vendor_id) ?? 'Vendor',
    secondary: (item) => {
      const count = list(item.banks).length;
      return `${count} account${count === 1 ? '' : 's'}`;
    },
    cardFields: (item) => {
      const bank = list<Record<string, string>>(item.banks)[0];
      return [
        { label: 'Bank', value: bank?.bank_name },
        { label: 'Account', value: bank?.account_no },
        { label: 'Branch', value: bank?.branch },
        { label: 'IFSC', value: bank?.ifsc_code },
      ];
    },
    search: (item, names) => [
      names('vendor', item.vendor_id),
      ...list<Record<string, string>>(item.banks).flatMap((bank) => [bank.bank_name, bank.account_no, bank.ifsc_code]),
    ],
    fields: [
      { key: 'vendor_id', label: 'Vendor', type: 'reference', source: 'vendor', required: true },
      {
        key: 'banks',
        label: 'Bank accounts',
        type: 'object-list',
        itemLabel: 'Account',
        required: true,
        itemFields: [
          { key: 'bank_name', label: 'Bank name' },
          { key: 'branch', label: 'Branch' },
          { key: 'account_no', label: 'Account no' },
          { key: 'ifsc_code', label: 'IFSC code' },
        ],
      },
    ],
  },

  // ----------------------------------------------------- warehouse location
  'warehouse-location': {
    key: 'warehouse-location',
    title: 'Warehouses',
    singular: 'Warehouse',
    icon: 'home-outline',
    description: 'Locations and the sub-locations inside them',
    resource: 'warehouse-locations',
    primary: (item) => str(item.location_name),
    secondary: (item) => {
      const names = list<{ name?: string }>(item.sub_locations)
        .map((sub) => sub.name)
        .filter(Boolean);
      return names.length ? names.join(', ') : 'No sub-locations';
    },
    search: (item) => [item.location_name, ...list<{ name?: string }>(item.sub_locations).map((sub) => sub.name)],
    fields: [
      { key: 'location_name', label: 'Location name', type: 'text', required: true },
      {
        key: 'sub_locations',
        label: 'Sub-locations',
        type: 'object-list',
        itemLabel: 'Sub-location',
        required: true,
        rowId: 'id',
        itemFields: [{ key: 'name', label: 'Name', required: true }],
      },
    ],
  },
};

export const getMasterConfig = (key?: string): MasterConfig | undefined =>
  key ? MASTER_CONFIGS[key] : undefined;
