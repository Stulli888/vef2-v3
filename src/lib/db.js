import { readFile } from 'fs/promises';
import pg from 'pg';

import { slugify } from './slugify.js';

const SCHEMA_FILE = './sql/schema.sql';
const DROP_SCHEMA_FILE = './sql/drop.sql';

const { DATABASE_URL: connectionString, NODE_ENV: nodeEnv = 'development' } =
  process.env;

if (!connectionString) {
  console.error('vantar DATABASE_URL í .env');
  process.exit(-1);
}

// Notum SSL tengingu við gagnagrunn ef við erum *ekki* í development
// mode, á heroku, ekki á local vél
const ssl = nodeEnv === 'production' ? { rejectUnauthorized: false } : false;

const pool = new pg.Pool({ connectionString, ssl });

pool.on('error', (err) => {
  console.error('Villa í tengingu við gagnagrunn, forrit hættir', err);
  process.exit(-1);
});

export async function query(q, values = []) {
  let client;
  try {
    client = await pool.connect();
  } catch (e) {
    console.error('unable to get client from pool', e);
    return null;
  }

  try {
    const result = await client.query(q, values);
    return result;
  } catch (e) {
    if (nodeEnv !== 'test') {
      console.error('unable to query', e);
    }
    return null;
  } finally {
    client.release();
  }
}

export async function createSchema(schemaFile = SCHEMA_FILE) {
  const data = await readFile(schemaFile);
  return query(data.toString('utf-8'));
}

export async function dropSchema(dropFile = DROP_SCHEMA_FILE) {
  const data = await readFile(dropFile);

  return query(data.toString('utf-8'));
}

export async function createEvent({ name, slug, description, maker } = {}) {
  const q = `
    INSERT INTO events
      (name, slug, description, maker)
    VALUES
      ($1, $2, $3, $4)
    RETURNING id, name, slug, description, maker
  `;
  const values = [name, slug, description, maker];
  const result = await query(q, values);
  if (result && result.rowCount === 1) {
    return result.rows[0];
  }
  return null;
}

// Updatear ekki description, erum ekki að útfæra partial update
export async function updateEvent(id, { name, slug, description } = {}) {
  const q = `
    UPDATE events
      SET
        name = $1,
        slug = $2,
        description = $3,
        updated = CURRENT_TIMESTAMP
    WHERE
      id = $4
    RETURNING id, name, slug, description;
  `;
  const values = [name, slug, description, id];
  const result = await query(q, values);

  if (result && result.rowCount === 1) {
    return result.rows[0];
  }
  return null;
}

export async function register({ name, comment, event } = {}) {
  const q = `
    INSERT INTO registrations
      (name, comment, event)
    VALUES
      ($1, $2, $3)
    RETURNING
      id, name, comment, event;
  `;
  const values = [name, comment, event];
  const result = await query(q, values);
  if (result && result.rowCount === 1) {
    return result.rows[0];
  }
  return null;
}

export async function listUsers() {
  const q = `
    SELECT
      id, username
    FROM
      users
  `;

  const result = await query(q);

  if (result) {
    return result.rows;
  }
  return null;
}


export async function conditionalUpdate(table, id, fields, values) {
  const filteredFields = fields.filter((i) => typeof i === 'string');
  const filteredValues = values
    .filter((i) => typeof i === 'string'
      || typeof i === 'number'
      || i instanceof Date);

  if (filteredFields.length === 0) {
    return false;
  }

  if (filteredFields.length !== filteredValues.length) {
    throw new Error('fields and values must be of equal length');
  }

  // id is field = 1
  const updates = filteredFields.map((field, i) => `${field} = $${i + 2}`);

  const q = `
    UPDATE ${table}
      SET ${updates.join(', ')}
    WHERE
      id = $1
    RETURNING *
    `;

  const queryValues = [id].concat(filteredValues);

  console.info('Conditional update', q, queryValues);

  const result = await query(q, queryValues);

  return result;
}

export async function getAllEvents() {
  const q = `
    SELECT
      id, name
    FROM
      events
  `;

  const result = await query(q);
  if (result) {
    return result.rows;
  }
  return null;
}

export async function registerEvent(name, description, maker) {
  const q = `
    INSERT INTO events
      (name, slug, description, maker)
    VALUES
      ($1, $2, $3, $4)
    RETURNING
    id, name, slug, description, maker
  `;
  const values = [name, slugify(name), description, maker];
  const result = await query(q, values);
  if (result && result.rowCount === 1) {
    return result.rows[0];
  }
  return null;
}

export async function getEventById(id) {
  const q = `
    SELECT
      *
    FROM 
      events
    WHERE
      id = $1
  `;
  const result = await query(q, [id]);
  if (result && result.rowCount === 1) {
    return result.rows[0];
  }

  return null;
}

export async function deleteEventRow(id) {
  const q = `
    DELETE FROM
      events
    WHERE
      id = $1
  `;
  return query(q, [id]);
}

export async function deleteRegistration(name, event) {
  const q = `
    DELETE FROM
      registrations
    WHERE
    id = $1 AND name = $2
  `;
  return query(q, [event, name]);
}

export async function end() {
  await pool.end();
}
