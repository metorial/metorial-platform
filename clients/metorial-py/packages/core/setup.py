from setuptools import setup

setup(
  name="metorial-core",
  packages=["metorial_core"],
  version="0.1.0",
  description="Core Python client for Metorial APIs.",
  author="Metorial Team",
  author_email="support@metorial.com",
  url="https://github.com/metorial/metorial",
  py_modules=["metorial_util_endpoint"],
  install_requires=[
    "requests>=2.25.1",
    "dataclasses; python_version<'3.7'",
    "metorial_util_endpoint>=0.1.0",
  ],
  python_requires=">=3.6",
  license="MIT",
  classifiers=[
    "Programming Language :: Python :: 3",
    "License :: OSI Approved :: MIT License",
    "Operating System :: OS Independent",
  ],
  include_package_data=True,
)
