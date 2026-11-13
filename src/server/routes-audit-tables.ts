import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { transaction } from './transaction.ts';
import { pool } from './db.ts';
import {
  createTableSchema,
  getTableSchemas,
  getTableSchema,
  deleteTableSchema,
  insertTableData,
  updateTableData,
  deleteTableData,
  getTableData,
  getDataVersions,
  reorderTableData,
  bulkInsertTableData,
  type ColumnDefinition,
} from './db-audit-tables.ts';

export function registerAuditTablesRoutes(app: FastifyInstance) {
  const columnDefinitionSchema = z.object({
    name: z.string(),
    type: z.enum(['text', 'number', 'date', 'boolean', 'select']),
    label: z.string(),
    required: z.boolean().optional(),
    options: z.array(z.string()).optional(),
    default_value: z.unknown().optional(),
  });

  app.get('/api/audit/schemas', async (_req, reply) => {
    try {
      const schemas = await transaction((client) => getTableSchemas(client), pool);
      return { schemas };
    } catch (error) {
      reply.code(500);
      return { error: 'Failed to fetch table schemas' };
    }
  });

  app.get<{ Params: { schemaId: string } }>(
    '/api/audit/schemas/:schemaId',
    async (request, reply) => {
      try {
        const { schemaId } = z.object({ schemaId: z.uuid() }).parse(request.params);
        const schema = await transaction((client) => getTableSchema(client, schemaId), pool);
        if (!schema) {
          reply.code(404);
          return { error: 'Table schema not found' };
        }
        return { schema };
      } catch (error) {
        reply.code(500);
        return { error: 'Failed to fetch table schema' };
      }
    },
  );

  app.post('/api/audit/schemas', async (request, reply) => {
    try {
      const body = z
        .object({
          table_name: z.string().min(1).max(100),
          display_name: z.string().min(1).max(200),
          n8n_workflow_id: z.string().optional(),
          column_definitions: z.array(columnDefinitionSchema),
        })
        .parse(request.body);

      const schema = await transaction(
        (client) =>
          createTableSchema(client, {
            table_name: body.table_name,
            display_name: body.display_name,
            n8n_workflow_id: body.n8n_workflow_id,
            column_definitions: body.column_definitions as ColumnDefinition[],
          }),
        pool,
      );

      reply.code(201);
      return { schema };
    } catch (error) {
      reply.code(500);
      return { error: 'Failed to create table schema' };
    }
  });

  app.delete<{ Params: { schemaId: string } }>(
    '/api/audit/schemas/:schemaId',
    async (request, reply) => {
      try {
        const { schemaId } = z.object({ schemaId: z.uuid() }).parse(request.params);
        await transaction((client) => deleteTableSchema(client, schemaId), pool);
        return { success: true };
      } catch (error) {
        reply.code(500);
        return { error: 'Failed to delete table schema' };
      }
    },
  );

  app.get<{ Params: { schemaId: string } }>(
    '/api/audit/schemas/:schemaId/data',
    async (request, reply) => {
      try {
        const { schemaId } = z.object({ schemaId: z.uuid() }).parse(request.params);
        const data = await transaction((client) => getTableData(client, schemaId), pool);
        return { data };
      } catch (error) {
        reply.code(500);
        return { error: 'Failed to fetch table data' };
      }
    },
  );

  app.post<{ Params: { schemaId: string } }>(
    '/api/audit/schemas/:schemaId/data',
    async (request, reply) => {
      try {
        const { schemaId } = z.object({ schemaId: z.uuid() }).parse(request.params);
        const body = z
          .object({
            row_data: z.record(z.unknown()),
          })
          .parse(request.body);

        const data = await transaction(
          (client) =>
            insertTableData(client, {
              table_schema_id: schemaId,
              row_data: body.row_data,
            }),
          pool,
        );

        reply.code(201);
        return { data };
      } catch (error) {
        reply.code(500);
        return { error: 'Failed to insert table data' };
      }
    },
  );

  app.post<{ Params: { schemaId: string } }>(
    '/api/audit/schemas/:schemaId/data/bulk',
    async (request, reply) => {
      try {
        const { schemaId } = z.object({ schemaId: z.uuid() }).parse(request.params);
        const body = z
          .object({
            rows: z.array(z.record(z.unknown())),
          })
          .parse(request.body);

        const data = await transaction(
          (client) =>
            bulkInsertTableData(client, {
              table_schema_id: schemaId,
              rows: body.rows,
            }),
          pool,
        );

        reply.code(201);
        return { data };
      } catch (error) {
        reply.code(500);
        return { error: 'Failed to bulk insert table data' };
      }
    },
  );

  app.put<{ Params: { dataId: string } }>('/api/audit/data/:dataId', async (request, reply) => {
    try {
      const { dataId } = z.object({ dataId: z.uuid() }).parse(request.params);
      const body = z
        .object({
          row_data: z.record(z.unknown()),
        })
        .parse(request.body);

      const data = await transaction(
        (client) =>
          updateTableData(client, {
            data_id: dataId,
            row_data: body.row_data,
          }),
        pool,
      );

      if (!data) {
        reply.code(404);
        return { error: 'Table data not found' };
      }

      return { data };
    } catch (error) {
      reply.code(500);
      return { error: 'Failed to update table data' };
    }
  });

  app.delete<{ Params: { dataId: string } }>('/api/audit/data/:dataId', async (request, reply) => {
    try {
      const { dataId } = z.object({ dataId: z.uuid() }).parse(request.params);
      await transaction((client) => deleteTableData(client, dataId), pool);
      return { success: true };
    } catch (error) {
      reply.code(500);
      return { error: 'Failed to delete table data' };
    }
  });

  app.put<{ Params: { dataId: string } }>(
    '/api/audit/data/:dataId/order',
    async (request, reply) => {
      try {
        const { dataId } = z.object({ dataId: z.uuid() }).parse(request.params);
        const body = z
          .object({
            new_order: z.number().int(),
          })
          .parse(request.body);

        await transaction(
          (client) =>
            reorderTableData(client, {
              data_id: dataId,
              new_order: body.new_order,
            }),
          pool,
        );

        return { success: true };
      } catch (error) {
        reply.code(500);
        return { error: 'Failed to reorder table data' };
      }
    },
  );

  app.get<{ Params: { dataId: string } }>(
    '/api/audit/data/:dataId/versions',
    async (request, reply) => {
      try {
        const { dataId } = z.object({ dataId: z.uuid() }).parse(request.params);
        const versions = await transaction((client) => getDataVersions(client, dataId), pool);
        return { versions };
      } catch (error) {
        reply.code(500);
        return { error: 'Failed to fetch data versions' };
      }
    },
  );
}
