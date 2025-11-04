#!/bin/bash

# Test Device Management API
# 硬件设备管理 API 测试脚本

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

API_BASE="http://localhost:8000"

# You need to get a valid token first by logging in
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." # Replace with your actual token

echo -e "${BLUE}=== HiPet Device Management API Tests ===${NC}\n"

# Test 1: Get all devices
echo -e "${GREEN}1. Get all devices${NC}"
curl -s -X GET "$API_BASE/devices" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq .
echo -e "\n"

# Test 2: Get device details
# Replace with actual device ID
DEVICE_ID="cmgn68tjn0000p7rngqvfh73g"
echo -e "${GREEN}2. Get device details${NC}"
curl -s -X GET "$API_BASE/devices/$DEVICE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq .
echo -e "\n"

# Test 3: Bind device to pet
# Replace with actual pet ID
PET_ID="cmgn5oz7h000pp7tefxzfqim2"
echo -e "${GREEN}3. Bind device to pet${NC}"
curl -s -X POST "$API_BASE/devices/bind" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "CAMERA-001-EEFF1122",
    "petId": "'$PET_ID'",
    "bindingType": "owner"
  }' | jq .
echo -e "\n"

# Test 4: Get pet's devices
echo -e "${GREEN}4. Get pet devices${NC}"
curl -s -X GET "$API_BASE/devices/pets/$PET_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq .
echo -e "\n"

# Test 5: Get device events
echo -e "${GREEN}5. Get device events${NC}"
curl -s -X GET "$API_BASE/devices/$DEVICE_ID/events" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq .
echo -e "\n"

# Test 6: Update device status (simulating IoT device)
echo -e "${GREEN}6. Update device status${NC}"
curl -s -X POST "$API_BASE/devices/$DEVICE_ID/status" \
  -H "Content-Type: application/json" \
  -d '{
    "batteryLevel": 75,
    "signalStrength": 90,
    "location": {
      "lat": 34.052235,
      "lng": -118.243683,
      "accuracy": 10
    }
  }' | jq .
echo -e "\n"

# Test 7: Unbind device
# echo -e "${GREEN}7. Unbind device${NC}"
# curl -s -X POST "$API_BASE/devices/$DEVICE_ID/unbind" \
#   -H "Authorization: Bearer $TOKEN" \
#   -H "Content-Type: application/json" \
#   -d '{
#     "petId": "'$PET_ID'",
#     "reason": "testing"
#   }' | jq .
# echo -e "\n"

echo -e "${BLUE}=== Tests Completed ===${NC}"

