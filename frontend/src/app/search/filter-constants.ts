export const MEASUREMENT_PARAM_MAP = [
  { key: "bust_min", param: "measurement_bust_min" },
  { key: "bust_max", param: "measurement_bust_max" },
  { key: "waist_min", param: "measurement_waist_min" },
  { key: "waist_max", param: "measurement_waist_max" },
  { key: "hip_min", param: "measurement_hip_min" },
  { key: "hip_max", param: "measurement_hip_max" },
  { key: "length_min", param: "measurement_length_min" },
  { key: "length_max", param: "measurement_length_max" },
] as const;

export type MeasurementSelectionKey = (typeof MEASUREMENT_PARAM_MAP)[number]["key"];
export type MeasurementParamName = (typeof MEASUREMENT_PARAM_MAP)[number]["param"];

export const MEASUREMENT_FIELD_CONFIG = {
  bust_cm: {
    minKey: "bust_min" as MeasurementSelectionKey,
    maxKey: "bust_max" as MeasurementSelectionKey,
    minParam: "measurement_bust_min" as MeasurementParamName,
    maxParam: "measurement_bust_max" as MeasurementParamName,
  },
  waist_cm: {
    minKey: "waist_min" as MeasurementSelectionKey,
    maxKey: "waist_max" as MeasurementSelectionKey,
    minParam: "measurement_waist_min" as MeasurementParamName,
    maxParam: "measurement_waist_max" as MeasurementParamName,
  },
  hip_cm: {
    minKey: "hip_min" as MeasurementSelectionKey,
    maxKey: "hip_max" as MeasurementSelectionKey,
    minParam: "measurement_hip_min" as MeasurementParamName,
    maxParam: "measurement_hip_max" as MeasurementParamName,
  },
  length_cm: {
    minKey: "length_min" as MeasurementSelectionKey,
    maxKey: "length_max" as MeasurementSelectionKey,
    minParam: "measurement_length_min" as MeasurementParamName,
    maxParam: "measurement_length_max" as MeasurementParamName,
  },
} as const;

export type MeasurementField = keyof typeof MEASUREMENT_FIELD_CONFIG;
