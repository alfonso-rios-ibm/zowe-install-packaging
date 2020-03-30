/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright IBM Corporation 2020
 */

const util = require('util');
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');
const debug = require('debug')('zowe-install-test:utils');

const {
  ANSIBLE_ROOT_DIR,
  SANITY_TEST_REPORTS_DIR,
  INSTALL_TEST_REPORTS_DIR,
} = require('./constants');

/**
 * Sleep for certain time
 * @param {Integer} ms 
 */
const sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Check if there are any mandatory environment variable is missing.
 * 
 * @param {Array} vars     list of env variable names
 */
const checkMandatoryEnvironmentVariables = (vars) => {
  for (let v of vars) {
    expect(process.env).toHaveProperty(v);
  }
};

/**
 * Generate MD5 hash of a variable
 *
 * @param {Any} obj        any object
 */
const calculateHash = (obj) => {
  return crypto.createHash('md5').update(util.format('%j', obj)).digest('hex');
};

/**
 * Copy sanity test report to install test report folder for future publish.
 *
 * @param {String} reportHash      report hash
 */
const copySanityTestReport = (reportHash) => {
  debug(`Copy sanity test report of ${reportHash}`);
  if (fs.pathExistsSync(path.resolve(SANITY_TEST_REPORTS_DIR, 'junit.xml'))) {
    debug(`Found junit.xml in ${SANITY_TEST_REPORTS_DIR}`);
    const targetReportDir = path.resolve(INSTALL_TEST_REPORTS_DIR, `${reportHash}`);
    debug(`- copy to ${targetReportDir}`);
    fs.ensureDirSync(targetReportDir);
    fs.copySync(SANITY_TEST_REPORTS_DIR, targetReportDir);
  } else {
    debug(`junit.xml NOT found in ${SANITY_TEST_REPORTS_DIR}`);
  }
};

/**
 * Clean up sanity test report directory for next test
 */
const cleanupSanityTestReportDir = () => {
  debug(`Clean up sanity test reeport directory: ${SANITY_TEST_REPORTS_DIR}`);
  fs.removeSync(SANITY_TEST_REPORTS_DIR);
  fs.ensureDirSync(SANITY_TEST_REPORTS_DIR);
};

/**
 * Import extra vars for Ansible playbook from environment variables.
 * 
 * @param {Object} extraVars      Object
 */
const importDefaultExtraVars = (extraVars) => {
  const defaultMapping = {
    'ansible_ssh_host': 'SSH_HOST',
    'ansible_port': 'SSH_PORT',
    'ansible_user': 'SSH_USER',
    'ansible_password': 'SSH_PASSWD',
    'zos_node_home': 'ZOS_NODE_HOME',
    'zowe_sanity_test_debug_mode': 'SANITY_TEST_DEBUG',
  };

  Object.keys(defaultMapping).forEach((item) => {
    if (process.env[defaultMapping[item]]) {
      extraVars[item] = process.env[defaultMapping[item]];
    }
  });
};

/**
 * Run Ansible playbook
 *
 * @param  {String}    testcase 
 * @param  {String}    playbook
 * @param  {String}    serverId
 * @param  {Object}    extraVars
 * @param  {String}    verbose
 */
const runAnsiblePlaybook = (testcase, playbook, serverId, extraVars = {}, verbose = '-v') => {
  return new Promise((resolve, reject) => {
    let result = {
      reportHash: calculateHash(testcase),
      code: null,
      stdout: '',
      stderr: '',
    };
    // import default vars
    if (!extraVars) {
      extraVars = {};
    }
    importDefaultExtraVars(extraVars);
    let params = [
      '-l', serverId,
      playbook,
      process.env.ANSIBLE_VERBOSE || verbose,
      `--extra-vars`,
      util.format('%j', extraVars),
    ];
    let opts = {
      cwd: ANSIBLE_ROOT_DIR,
      stdio: 'inherit',
    };

    debug(`Playbook ${playbook} started with parameter: ${util.format('%j', params)}`);
    const pb = spawn('ansible-playbook', params, opts);

    pb.on('error', (err) => {
      process.stderr.write('Child Process Error: ' + err);
      result.error = err;

      reject(result);
    });

    pb.on('close', (code) => {
      result.code = code;

      if (code === 0) {
        resolve(result);
      } else {
        reject(result);
      }
    });
  });
};

// export constants and methods
module.exports = {
  sleep,
  checkMandatoryEnvironmentVariables,
  calculateHash,
  copySanityTestReport,
  cleanupSanityTestReportDir,
  runAnsiblePlaybook,
};
