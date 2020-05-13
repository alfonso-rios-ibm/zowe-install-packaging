#!/bin/sh

################################################################################
# This program and the accompanying materials are made available under the terms of the
# Eclipse Public License v2.0 which accompanies this distribution, and is available at
# https://www.eclipse.org/legal/epl-v20.html
#
# SPDX-License-Identifier: EPL-2.0
#
# Copyright IBM Corporation 2020
################################################################################

# TODO LATER - anyway to do this better?
# Try and work out where we are even if sourced
if [[ -n ${INSTALL_DIR} ]]
then
  export utils_dir="${INSTALL_DIR}/bin/utils"
elif [[ -n ${ZOWE_ROOT_DIR} ]]
then
  export utils_dir="${ZOWE_ROOT_DIR}/bin/utils"
elif [[ -n ${ROOT_DIR} ]]
then
  export utils_dir="${ROOT_DIR}/bin/utils"
elif [[ $0 == "node-utils.sh" ]] #Not called by source
then
  export utils_dir=$(cd $(dirname $0);pwd)
else
  echo "Could not work out the path to the utils directory. Please 'export ZOWE_ROOT_DIR=<zowe-install-directory' before running." 1>&2
  exit 1
fi

# Source common util functions
. ${utils_dir}/common.sh

ensure_node_is_on_path() {
  if [[ ":$PATH:" != *":$NODE_HOME/bin:"* ]]
  then
    echo "Appending NODE_HOME/bin to the PATH..."
    export PATH=$PATH:$NODE_HOME/bin
  fi
}

validate_node_home() {
  validate_node_home_not_empty
  node_empty_rc=$?
  if [[ ${node_empty_rc} -ne 0 ]]
  then
    return ${node_empty_rc}
  fi

  ls ${NODE_HOME}/bin | grep node$ > /dev/null
  if [[ $? -ne 0 ]];
  then
    print_error_message "NODE_HOME: ${NODE_HOME}/bin does not point to a valid install of Node"
    return 1
  fi

  node_ok=`${NODE_HOME}/bin/node -e "console.log('ok')" 2>&1`
  if [[ ${node_ok} == "ok" ]]
  then
    echo "OK: Node is working"
  else
    print_error_message "NODE_HOME: ${NODE_HOME}/bin/node is not functioning correctly: ${node_ok}"
    return 1
  fi

  node_version=`${NODE_HOME}/bin/node --version`
  check_node_version_number "${node_version}"
  node_version_rc=$?
  if [[ ${node_version_rc} -eq 0 ]]
  then
    echo "OK: Node ${node_version} is a supported version"
  fi
  return ${node_version_rc}
}

validate_node_home_not_empty() {
  . ${utils_dir}/zowe-variable-utils.sh
  validate_variable_is_set "NODE_HOME" "${NODE_HOME}"
  return $?
}

# Given a node version from the `node --version` command, checks if it is valid
check_node_version() {
  node_version=$1

  if [[ ${node_version} == "v8.16.1" ]]
  then
    print_error_message "Node Version 8.16.1 is not compatible with Zowe. Please use a different version. See https://docs.zowe.org/stable/troubleshoot/app-framework/app-known-issues.html#desktop-apps-fail-to-load for more details"
    return 1
  fi

  node_major_version=$(echo ${node_version} | cut -d '.' -f 1 | cut -d 'v' -f 2)
  node_minor_version=$(echo ${node_version} | cut -d '.' -f 2)
  node_fix_version=$(echo ${node_version} | cut -d '.' -f 3)
  
  too_low=""
  if [[ ${node_major_version} -lt 6 ]]
  then
    too_low="true"
  elif [[ ${node_major_version} -eq 6 ]] && [[ $node_minor_version -lt 14 ]]
  then
    too_low="true"
  elif [[ ${node_major_version} -eq 6 ]] && [[ $node_minor_version -eq 14 ]] && [[ $node_fix_version -lt 4 ]]
  then
    too_low="true"
  fi

  if [[ ${too_low} == "true" ]]
  then
    print_error_message "Node Version ${node_version} is less than the minimum level required of v6.14.4"
    return 1
  fi
}

# TODO - refactor this into shared script?
# Note requires #ROOT_DIR to be set to use errror.sh, otherwise falls back to stderr
print_error_message() {
  message=$1
  error_path=${ROOT_DIR}/scripts/utils/error.sh
  if [[ -f "${error_path}" ]]
  then
    . ${error_path} $message
  else 
    echo $message 1>&2
  fi
}