import { body } from 'express-validator';
import xss from 'xss';
import {comparePasswords, findUserByUsername} from '../lib/users.js';
import { LoginError } from '../utils/errorsHandler.js';
import { logger } from '../utils/logger.js';

export const validationUsernameAndPass = [
  body('username')
    .isLength({ min: 1,})
    .withMessage('Notendarnafn verður að vera a.m.k 1 stafir'),
  body('username')
    .isLength({ max: 64})
    .withMessage('Notendarnafn má ekki vera lengri en 64 stafir'),
  body('password')
    .isLength({ min: 1})
    .withMessage('Lykilorð verður að vera a.m.k 1 stafir'),
  body('password')
    .isLength({ max: 64})
    .withMessage('Lykilorð má ekki vera lengra en 64 stafir')
];

export const xssSanitizationUsername = [
  body('username').customSanitizer((v) => xss(v))
];

export const sanitizationMiddlewareUsername = [
  body('username').trim().escape(),
];

export const usernameDoesNotExistValidator = body('username')
  .custom(async (username) => {
    const user = await findUserByUsername(username);
    if (user) {
      return Promise.reject(new Error('username already exists'));
    }
    return Promise.resolve();
 });

 export const usernameAndPaswordValidValidator = body('username')
  .custom(async (username, { req: { body: reqBody } = {} }) => {
    // Can't bail after username and password validators, so some duplication
    // of validation here
    // TODO use schema validation instead?
    const { password } = reqBody;

    if (!username || !password) {
      return Promise.reject(new Error('skip'));
    }

    let valid = false;
    try {
      const user = await findUserByUsername(username);
      valid = await comparePasswords(password, user.password);
    } catch (e) {
      // Here we would track login attempts for monitoring purposes
      logger.info(`invalid login attempt for ${username}`);
    }

    if (!valid) {
      return Promise.reject(new LoginError('username or password incorrect'));
    }
    return Promise.resolve();
  });

  export function atLeastOneBodyValueValidator(fields) {
    return body()
      .custom(async (value, { req }) => {
        const { body: reqBody } = req;

        let valid = false;

        for (let i = 0; i < fields.length; i += 1) {
          const field = fields[i];

          if (field in reqBody && reqBody[field] != null) {
            valid = true;
            break;
          }
        }

        if (!valid) {
          return Promise.reject(new Error(`require at least one value of: ${fields.join(', ')}`));
        }
        return Promise.resolve();
      });
  }

export const validateEvent = [
body('name')
  .isLength({ min: 1,})
  .withMessage('Viðburður verður að hafa nafn'),
body('name')
  .isLength({ max: 64})
  .withMessage('Viðburðarnafn getur ekki verið lengra en 64 stafir'),
];

export const xssSanitizeEvent = [
  body('name').customSanitizer((v) => xss(v))
];