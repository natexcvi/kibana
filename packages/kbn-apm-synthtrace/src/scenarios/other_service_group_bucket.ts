/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */
import { range as lodashRange } from 'lodash';
import { ApmFields, apm } from '@kbn/apm-synthtrace-client';
import { Scenario } from '../cli/scenario';

const scenario: Scenario<ApmFields> = async (runOptions) => {
  const { logger } = runOptions;
  const numServices = 10;

  return {
    generate: ({ range }) => {
      const TRANSACTION_TYPES = ['request'];
      const ENVIRONMENTS = ['production', 'development'];

      const MIN_DURATION = 10;
      const MAX_DURATION = 1000;

      const MAX_BUCKETS = 50;

      const BUCKET_SIZE = (MAX_DURATION - MIN_DURATION) / MAX_BUCKETS;

      const serviceRange = [
        ...lodashRange(0, numServices).map((groupId) => `service-${groupId}`),
        '_other',
      ];

      const instances = serviceRange.flatMap((serviceName) => {
        const services = ENVIRONMENTS.map((env) => apm.service(serviceName, env, 'go'));

        return lodashRange(0, 2).flatMap((serviceNodeId) =>
          services.map((service) => service.instance(`${serviceName}-${serviceNodeId}`))
        );
      });

      const transactionGroupRange = [
        ...lodashRange(0, 10).map((groupId) => `transaction-${groupId}`),
        '_other',
      ];

      return range.ratePerMinute(60).generator((timestamp, timestampIndex) => {
        return logger.perf(
          'generate_events_for_timestamp ' + new Date(timestamp).toISOString(),
          () => {
            const events = instances.flatMap((instance) =>
              transactionGroupRange.flatMap((groupId, groupIndex) => {
                const duration = Math.round(
                  (timestampIndex % MAX_BUCKETS) * BUCKET_SIZE + MIN_DURATION
                );

                return instance
                  .transaction(groupId, TRANSACTION_TYPES[groupIndex % TRANSACTION_TYPES.length])
                  .timestamp(timestamp)
                  .duration(duration)
                  .outcome('success' as const);
              })
            );

            return events;
          }
        );
      });
    },
  };
};

export default scenario;
