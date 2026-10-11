// Vehicle preconditions that must hold before and during a firmware update.

export interface VehicleState {
  speedKph: number
  batteryVoltage: number
  ignitionOn: boolean
  parkingBrakeSet: boolean
  ambientTempC: number
}

export interface PreconditionResult {
  ok: boolean
  failed: string[]
}

export const MIN_BATTERY_VOLTAGE = 9.0
export const MAX_AMBIENT_TEMP_C = 85

/**
 * Checks that the vehicle is in a state where an update may start.
 */
export const checkPreconditions = (state: VehicleState): PreconditionResult => {
  const failed: string[] = []

  if (state.speedKph > 0) failed.push('vehicleMoving')
  if (state.batteryVoltage < MIN_BATTERY_VOLTAGE) failed.push('voltageTooLow')
  if (!state.ignitionOn) failed.push('ignitionOff')
  if (state.ambientTempC > MAX_AMBIENT_TEMP_C) failed.push('temperatureTooHigh')

  return { ok: failed.length === 0, failed }
}

/**
 * A stationary, healthy vehicle. Used by the simulator.
 */
export const nominalVehicleState = (): VehicleState => ({
  speedKph: 0,
  batteryVoltage: 12.6,
  ignitionOn: true,
  parkingBrakeSet: true,
  ambientTempC: 22,
})
