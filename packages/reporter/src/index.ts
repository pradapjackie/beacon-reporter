import { BeaconReporter } from './reporter';

export type { BeaconPlugin, BeaconReporterOptions, BeaconTestDetail } from './reporter';
export { BeaconReporter };

// Playwright resolves `reporter: [['beacon-reporter', options]]` to this module's
// default export and instantiates it with the options object.
export default BeaconReporter;
