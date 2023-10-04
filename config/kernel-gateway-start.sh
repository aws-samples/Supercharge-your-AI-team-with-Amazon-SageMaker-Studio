#!/bin/bash
# This script sets up your SageMaker Studio Kernel Gateway Application

##############################################################
# Debugging
##############################################################
set -eux
#  -e exit immediately if any (compound) command fails
#  -u treat expanding unset variables as error
#  -x print each command before executing



##############################################################
# Install Artifactory Mirroring for pip and conda
##############################################################
# Set the config to enable installation of python packages

# Use the Artifactory repository pypi-remote to only receive packages from pypi.org or https://files.pythonhosted.org
# pip config --user set global.index-url https://your.company'S artifactory
# pip config --user set global.trusted-host yourcompany.com

# Use Artifactory repository anaconda-conda-remote
# if command -v conda &> /dev/null
# then
#    conda config --add channels https://your company's artifactory
# fi

##############################################################
# Install Config Package
##############################################################

# We need setuptools, and it may not be part of all images
# pip install setuptools --upgrade



