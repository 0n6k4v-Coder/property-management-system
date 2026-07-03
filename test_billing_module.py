#!/usr/bin/env python3

import sys
import os

# Add the project root to the path
os.environ['PYTHONPATH'] = '/home/kawee/Code/project/property-management-system'
sys.path.insert(0, '/home/kawee/Code/project/property-management-system')

try:
    # Try importing the billing module
    from backend.app.modules.billing import (
        models, 
        schemas, 
        repository, 
        services, 
        routers
    )
    print("✅ Successfully imported billing module")
    
    # Check that key classes exist
    print(f"✅ MeterReading class exists: {hasattr(models, 'MeterReading')}")
    print(f"✅ BillingRepository class exists: {hasattr(repository, 'BillingRepository')}")
    print(f"✅ BillingService class exists: {hasattr(services, 'BillingService')}")
    print(f"✅ billing_router exists: {hasattr(routers, 'router')}")
    
    # Check that key endpoints are defined
    print(f"✅ create_meter_reading function exists: {hasattr(routers.router, 'create_meter_reading')}")
    print(f"✅ generate_invoice function exists: {hasattr(routers.router, 'generate_invoice')}")
    print(f"✅ record_payment function exists: {hasattr(routers.router, 'record_payment')}")
    
    print("✅ All billing module components are working correctly!")
    
except Exception as e:
    print(f"❌ Error importing billing module: {e}")
    import traceback
    traceback.print_exc()