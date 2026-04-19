"""
Setup script for Sound It CLI
"""
from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="soundit-cli",
    version="1.0.0",
    author="Sound It Team",
    author_email="admin@sounditent.com",
    description="Command Line Interface for Sound It Platform",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/soundit/soundit-cli",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Intended Audience :: System Administrators",
        "Topic :: Utilities",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
    python_requires=">=3.8",
    install_requires=[
        "click>=8.0.0",
        "requests>=2.28.0",
    ],
    entry_points={
        "console_scripts": [
            "soundit=soundit_cli.commands:main",
        ],
    },
)
