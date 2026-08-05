import type { Ionicons } from '@expo/vector-icons';

import type { RecordField } from '@/components/record-card';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';

/**
 * Master-data registry.
 *
 * Fifteen master screens differ only in their fields, so they are described
 * here as data and rendered by one list screen and one form screen. Adding a
 * master is a config entry, not a new screen — and every master then behaves
 * identically: same search, same validation placement, same delete guard.
 */

export type ReferenceSource = 'commodity' | 'company' | 'bag-type' | 'bag-grade' | 'vendor';

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
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** Where a `reference*` field's options come from. */
  source?: ReferenceSource;
  /** Fixed choices for an `options` field. */
  options?: { label: string; value: string }[];
  /** `options` accepts more than one value. */
  multiple?: boolean;
  /** Sub-fields of an `object-list` row. */
  itemFields?: { key: string; label: string; type?: 'text' | 'phone' | 'email' }[];
  /** Row label for list fields, e.g. "Contact". */
  itemLabel?: string;
  /** Field is shown but never sent — server-derived. */
  readOnly?: boolean;
  suffix?: string;
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
  primary: (item: Record<string, unknown>) => string;
  secondary?: (item: Record<string, unknown>) => string | undefined;
  cardFields?: (item: Record<string, unknown>) => RecordField[];
  search: (item: Record<string, unknown>) => unknown[];
  fields: MasterField[];
  /** Records can be edited but not created or deleted (Item Rates). */
  editOnly?: boolean;
}

const str = (value: unknown) => (value === null || value === undefined ? '' : String(value));

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
      { label: 'Mobile', value: str(item.mobile_no) },
      { label: 'PAN', value: str(item.pan_no) },
      { label: 'Bank', value: str(item.bank_name) },
      { label: 'Account', value: str(item.account_no) },
    ],
    search: (item) => [item.agent_name, item.mobile_no, item.email, item.pan_no, item.bank_name],
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
    primary: (item) => str(item.grade_name),
    cardFields: (item) => [{ label: 'Rate', value: item.rate ? formatCurrency(Number(item.rate)) : null }],
    search: (item) => [item.grade_name],
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
    editOnly: true,
    primary: (item) => str(item.grade_name),
    secondary: (item) => (item.rate ? `Rate ${formatCurrency(Number(item.rate))}` : 'No rate set'),
    search: (item) => [item.grade_name],
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
    primary: (item) => `${formatNumber(Number(item.bag_size_kg))} kg bag`,
    cardFields: (item) => [
      { label: 'Size', value: `${formatNumber(Number(item.bag_size_kg))} kg`, emphasis: true },
      { label: 'Tare weight', value: `${formatNumber(Number(item.bag_weight), 2)} kg` },
    ],
    search: (item) => [item.bag_size_kg, item.bag_weight],
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
    secondary: (item) => str(item.gst_no) || undefined,
    cardFields: (item) => [
      { label: 'GST', value: str(item.gst_no) },
      { label: 'PAN', value: str(item.pan_no) },
      { label: 'Challan', value: `${str(item.challan_prefix)}${str(item.challan_series)}` },
      { label: 'Established', value: item.date_of_establishment ? formatDate(String(item.date_of_establishment)) : null },
    ],
    search: (item) => [item.company_name, item.gst_no, item.pan_no, item.email, item.slug],
    fields: [
      { key: 'company_name', label: 'Company name', type: 'text', required: true },
      { key: 'slug', label: 'Slug', type: 'text', required: true, hint: 'Short code used on documents' },
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
    primary: (item) => str(item.group_name),
    secondary: (item) => `${(item.company_ids as string[] | undefined)?.length ?? 0} companies`,
    search: (item) => [item.group_name],
    fields: [
      { key: 'group_name', label: 'Group name', type: 'text', required: true },
      {
        key: 'company_ids',
        label: 'Companies',
        type: 'reference-multi',
        source: 'company',
        required: true,
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
    secondary: (item) => ((item.category as string[] | undefined) ?? []).join(' · ') || undefined,
    cardFields: (item) => [
      { label: 'GST', value: str(item.gst_no) },
      { label: 'State', value: str(item.state) },
      { label: 'Contacts', value: ((item.contact_details as unknown[] | undefined) ?? []).length },
      { label: 'Landline', value: str(item.landline_no) },
    ],
    search: (item) => [item.vendor_name, item.gst_no, item.pan_no, item.state],
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
      { key: 'state', label: 'State', type: 'options', required: true },
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
          { key: 'label', label: 'Label' },
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
    primary: (item) => `${((item.banks as unknown[] | undefined) ?? []).length} account(s)`,
    search: (item) => [
      ...(((item.banks as { bank_name?: string; account_no?: string }[] | undefined) ?? []).flatMap((bank) => [
        bank.bank_name,
        bank.account_no,
      ]) as string[]),
    ],
    fields: [
      { key: 'vendor_id', label: 'Vendor', type: 'reference', source: 'vendor', required: true },
      {
        key: 'banks',
        label: 'Bank accounts',
        type: 'object-list',
        itemLabel: 'Account',
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
    secondary: (item) => `${((item.sub_locations as unknown[] | undefined) ?? []).length} sub-locations`,
    search: (item) => [item.location_name],
    fields: [
      { key: 'location_name', label: 'Location name', type: 'text', required: true },
      {
        key: 'sub_locations',
        label: 'Sub-locations',
        type: 'object-list',
        itemLabel: 'Sub-location',
        itemFields: [{ key: 'name', label: 'Name' }],
      },
    ],
  },
};

export const getMasterConfig = (key?: string): MasterConfig | undefined =>
  key ? MASTER_CONFIGS[key] : undefined;
