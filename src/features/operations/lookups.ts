import { useMemo } from 'react';

import {
  useBagGrades,
  useBagTypeConfigurations,
  useBagTypes,
  useCommodities,
  useCompanies,
  useCompanyGroups,
  useGrades,
  useMachines,
  useSourceLocations,
  useVendors,
  useWarehouseLocations,
  useWeighBridges,
} from '@/api/masters-api';
import type { Option } from '@/components/ui/select';
import { usePermissions } from '@/hooks/use-permissions';
import { EM_DASH } from '@/lib/format';

const byLabel = (a: Option, b: Option) =>
  a.label.localeCompare(b.label, undefined, { sensitivity: 'base', numeric: true });

/**
 * Master lookups for the operations screens.
 *
 * Operations forms all reach for the same handful of collections, and every one
 * of them is small and cached by React Query — so they are fetched once here
 * and shared, rather than each screen assembling its own set of hooks.
 *
 * A master the role cannot read is never requested: every refused request
 * raises an "Access denied" toast, and a screen that needs only three of these
 * lists must not fail loudly over the other nine. Options are alphabetical,
 * as on the web.
 */
export function useMasterLookups() {
  const { can } = usePermissions();
  const commodities = useCommodities(can('commodity:read'));
  const grades = useGrades(can('grade:read'));
  const bagTypes = useBagTypes(can('bag-type:read'));
  const bagGrades = useBagGrades(can('bag-grade:read'));
  const bagTypeConfigs = useBagTypeConfigurations(can('bag-type-config:read'));
  const locations = useWarehouseLocations(can('warehouse-location:read'));
  const sourceLocations = useSourceLocations(can('source-location:read'));
  const weighBridges = useWeighBridges(can('weigh-bridge:read'));
  const companies = useCompanies(can('company:read'));
  const companyGroups = useCompanyGroups(can('company-group:read'));
  const vendors = useVendors(can('vendor:read'));
  const machines = useMachines(can('machine:read'));

  return useMemo(() => {
    const commodityOptions: Option[] = (commodities.data ?? []).map((item) => ({
      value: item._id,
      label: item.commodity_name,
    })).sort(byLabel);

    const gradeOptions: Option[] = (grades.data ?? []).map((item) => ({
      value: item._id,
      label: item.grade_name,
    })).sort(byLabel);

    const bagTypeOptions: Option[] = (bagTypes.data ?? []).map((item) => ({
      value: item._id,
      label: item.bag_type_name,
    })).sort(byLabel);

    /** "PP-A grade-50kg · tare 0.12 kg" — the label operators recognise. */
    const bagConfigOptions: Option[] = (bagTypeConfigs.data ?? []).map((config) => {
      const bagType = (bagTypes.data ?? []).find((type) => type._id === config.bag_type_id);
      const bagGrade = (bagGrades.data ?? []).find((grade) => grade._id === config.bag_grade_id);
      const parts = [bagType?.bag_type_name, bagGrade?.title, `${config.bag_size_kg}kg`].filter(Boolean);
      return {
        value: config._id,
        label: parts.join('-'),
        description: `Tare ${config.bag_weight ?? 0} kg`,
      };
    }).sort(byLabel);

    const locationOptions: Option[] = (locations.data ?? []).map((item) => ({
      value: item._id,
      label: item.location_name,
      description: `${item.sub_locations?.length ?? 0} sub-locations`,
    })).sort(byLabel);

    const subLocationOptionsFor = (locationId?: string | null): Option[] => {
      const location = (locations.data ?? []).find((item) => item._id === locationId);
      // Kept in the order the warehouse defines them. A row saved without an id
      // (older app builds) cannot be referenced, so it is not offered.
      return (location?.sub_locations ?? [])
        .filter((sub) => sub.id)
        .map((sub) => ({ value: sub.id, label: sub.name }));
    };

    const sourceLocationOptions: Option[] = (sourceLocations.data ?? []).map((item) => ({
      value: item._id,
      label: item.source_location_name,
    })).sort(byLabel);

    const weighBridgeOptions: Option[] = (weighBridges.data ?? []).map((item) => ({
      value: item._id,
      label: item.name,
    })).sort(byLabel);

    const companyOptions: Option[] = (companies.data ?? []).map((item) => ({
      value: item._id,
      label: item.company_name,
      description: item.gst_no || undefined,
    })).sort(byLabel);

    const companyGroupOptions: Option[] = (companyGroups.data ?? []).map((item) => ({
      value: item._id,
      label: item.group_name,
      description: `${item.company_ids?.length ?? 0} companies`,
    })).sort(byLabel);

    const vendorOptions: Option[] = (vendors.data ?? []).map((item) => ({
      value: item._id,
      label: item.vendor_name,
      description: (item.category ?? []).join(' · ') || undefined,
    })).sort(byLabel);

    const machineOptions: Option[] = (machines.data ?? []).map((item) => ({
      value: item._id,
      label: item.machine_name,
      description: item.locked_in_lot ? `Locked in lot ${item.locked_in_lot.lot_no}` : undefined,
      disabled: Boolean(item.locked_in_lot),
    })).sort(byLabel);

    /** Resolves an id to its display label; falls back to an em dash. */
    const nameFrom = (options: Option[], id?: string | null) =>
      options.find((option) => option.value === id)?.label ?? EM_DASH;

    return {
      isLoading:
        commodities.isLoading ||
        grades.isLoading ||
        bagTypes.isLoading ||
        locations.isLoading ||
        companyGroups.isLoading,
      raw: {
        commodities: commodities.data ?? [],
        grades: grades.data ?? [],
        bagTypes: bagTypes.data ?? [],
        bagGrades: bagGrades.data ?? [],
        bagTypeConfigs: bagTypeConfigs.data ?? [],
        locations: locations.data ?? [],
        companies: companies.data ?? [],
        companyGroups: companyGroups.data ?? [],
        vendors: vendors.data ?? [],
      },
      commodityOptions,
      gradeOptions,
      /** Grades are always scoped to their commodity — never offer the rest. */
      gradeOptionsFor: (commodityId?: string | null): Option[] =>
        (grades.data ?? [])
          .filter((grade) => grade.commodity_id === commodityId)
          .map((grade) => ({ value: grade._id, label: grade.grade_name }))
          .sort(byLabel),
      bagTypeOptions,
      bagConfigOptions,
      bagConfigOptionsFor: (bagTypeId?: string | null): Option[] =>
        bagConfigOptions.filter((option) =>
          (bagTypeConfigs.data ?? []).some((config) => config._id === option.value && config.bag_type_id === bagTypeId)
        ),
      locationOptions,
      subLocationOptionsFor,
      sourceLocationOptions,
      weighBridgeOptions,
      companyOptions,
      companyGroupOptions,
      vendorOptions,
      machineOptions,
      commodityName: (id?: string | null) => nameFrom(commodityOptions, id),
      gradeName: (id?: string | null) => nameFrom(gradeOptions, id),
      bagTypeName: (id?: string | null) => nameFrom(bagTypeOptions, id),
      bagConfigName: (id?: string | null) => nameFrom(bagConfigOptions, id),
      locationName: (id?: string | null) => nameFrom(locationOptions, id),
      subLocationName: (locationId?: string | null, subId?: string | null) =>
        nameFrom(subLocationOptionsFor(locationId), subId),
      sourceLocationName: (id?: string | null) => nameFrom(sourceLocationOptions, id),
      weighBridgeName: (id?: string | null) => nameFrom(weighBridgeOptions, id),
      companyName: (id?: string | null) => nameFrom(companyOptions, id),
      companyGroupName: (id?: string | null) => nameFrom(companyGroupOptions, id),
      vendorName: (id?: string | null) => nameFrom(vendorOptions, id),
      machineName: (id?: string | null) => nameFrom(machineOptions, id),
    };
  }, [
    commodities.data,
    commodities.isLoading,
    grades.data,
    grades.isLoading,
    bagTypes.data,
    bagTypes.isLoading,
    bagGrades.data,
    bagTypeConfigs.data,
    locations.data,
    locations.isLoading,
    sourceLocations.data,
    weighBridges.data,
    companies.data,
    companyGroups.data,
    companyGroups.isLoading,
    vendors.data,
    machines.data,
  ]);
}

export type MasterLookups = ReturnType<typeof useMasterLookups>;
