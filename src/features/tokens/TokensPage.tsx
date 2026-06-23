/**
 * TokensPage — Screen 05: TOKEN ENGINE ROOM 🚦 (Universal Token Definition Engine)
 *
 * Matches v26 mockups pixel-accurately:
 *   TOP:    Context strip → 4 KPIs → 5 mini bars → 3-col blades (Definitions | Detail | Waswa AI)
 *   MID:    Usage Event Metering → FIFO + VEBA Leakage → System Health Snapshot
 *   BOTTOM: Price Rule Versions + Trash → HITL box → Audit Log
 *   MODAL:  Create Token Definition wizard (Step 2/4, sections A–E)
 */
import React, { useState, useEffect, useMemo } from "react";
import { getRaw, post, put, del } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import { PermissionGate } from "../../auth/PermissionGate";

// ─── Colour helpers ──────────────────────────────────────────────────────────
const okBg  = "bg-[#25D366] text-[#053B33]";
const warnBg = "bg-[#F59E0B] text-white";
const alarmBg = "bg-[#F97316] text-white";
const critBg = "bg-[#EF4444] text-white";
const darkBg = "bg-[#075E54] text-white";
const azureBg = "bg-[#34B7F1] text-white";

// ─── Mock Data ───────────────────────────────────────────────────────────────
const TOKENS = [
  { code:"GPS_TIME_HR",     domain:"OLIWA",   rps:"8.6",  unit:"hour",   state:"Active" },
  { code:"FUEL_THEFT_EVT",  domain:"MAFUTA",  rps:"9.7",  unit:"event",  state:"Active" },
  { code:"DRIVER_SCORE",    domain:"PIKI",    rps:"9.2",  unit:"event",  state:"Active" },
  { code:"REPORT_EXPORT",   domain:"CORE",    rps:"8.3",  unit:"export", state:"Active" },
  { code:"BODA_LEAD_UNLOCK",domain:"VEBA",    rps:"9.9",  unit:"unlock", state:"Active" },
  { code:"D8_POWERON_MIN",  domain:"VEBA",    rps:"9.4",  unit:"minute", state:"Active" },
  { code:"VIDEO_SNAPSHOT",  domain:"DASHCAM", rps:"10.1", unit:"snap",   state:"Active" },
  { code:"AI_DEEP_AUDIT",   domain:"WASWA",   rps:"10.0", unit:"query",  state:"Active" },
  { code:"ROAMING_PACKET",  domain:"SIM",     rps:"8.8",  unit:"MB",     state:"Active" },
  { code:"KYC_VERIFY",      domain:"VEBA",    rps:"8.7",  unit:"check",  state:"Active" },
];

const PARAMS = [
  { param:"booking_contact_reveal", origin:"VEBA", cost:"1 unlock",   state:"Allow", control:"HITL" },
  { param:"chat_message_prepay",    origin:"VEBA", cost:"0.2 / msg",  state:"Allow", control:"Auto" },
  { param:"listing_view",           origin:"VEBA", cost:"0.05 / view",state:"Allow", control:"Auto" },
  { param:"offline_contact_detect", origin:"WASWA",cost:"0.4 / flag", state:"Allow", control:"Auto" },
  { param:"call_masking_proxy",     origin:"CORE", cost:"0.3 / min",  state:"Allow", control:"HITL" },
  { param:"payout_initiate",        origin:"PAY",  cost:"0.6 / tx",   state:"Allow", control:"HIC"  },
  { param:"refund_dispute",         origin:"PAY",  cost:"0.8 / case", state:"Allow", control:"HITL" },
];

const XIRGO_PARAMS = [
  { value: "regtime", label: "regtime" },
  { value: "sats", label: "sats" },
  { value: "speed", label: "speed" },
  { value: "course", label: "course" },
  { value: "altitude", label: "altitude" },
  { value: "lon", label: "lon" },
  { value: "lat", label: "lat" },
  { value: "avl_driver", label: "avl_driver" },
  { value: "adc2", label: "adc2" },
  { value: "adc6", label: "adc6" },
  { value: "adc12", label: "adc12" },
  { value: "adc16", label: "adc16" },
  { value: "cell_id", label: "cell_id" },
  { value: "engine_hours", label: "engine_hours" },
  { value: "f0", label: "f0" },
  { value: "f100", label: "f100" },
  { value: "f102", label: "f102" },
  { value: "f103", label: "f103" },
  { value: "lls_lvl_add1", label: "lls_lvl_add1" },
  { value: "lls_lvl_add2", label: "lls_lvl_add2" },
  { value: "lls_lvl_add3", label: "lls_lvl_add3" },
  { value: "lls_lvl_add4", label: "lls_lvl_add4" },
  { value: "lls_temp_add1", label: "lls_temp_add1" },
  { value: "lls_temp_add2", label: "lls_temp_add2" },
  { value: "lls_temp_add3", label: "lls_temp_add3" },
  { value: "lls_temp_add4", label: "lls_temp_add4" },
  { value: "can_taho", label: "can_taho" },
  { value: "dallas_id_end", label: "dallas_id_end" },
  { value: "dallas_id_end_hex", label: "dallas_id_end_hex" },
  { value: "dallas_id_end_hex_raw", label: "dallas_id_end_hex_raw" },
  { value: "engine_temp", label: "engine_temp" },
  { value: "mcc", label: "mcc" },
  { value: "mnc", label: "mnc" },
  { value: "odo", label: "odo" },
  { value: "ta", label: "ta" },
  { value: "in1", label: "IN-1" },
  { value: "in2", label: "IN-2" },
  { value: "in3", label: "IN-3" },
  { value: "in4", label: "IN-4" },
  { value: "in5", label: "IN-5" },
  { value: "in6", label: "IN-6" },
  { value: "in7", label: "IN-7" },
  { value: "in8", label: "IN-8" },
  { value: "in9", label: "IN-9" },
  { value: "in10", label: "IN-10" },
  { value: "in11", label: "IN-11" },
  { value: "in12", label: "IN-12" },
  { value: "in13", label: "IN-13" },
  { value: "in14", label: "IN-14" },
  { value: "in15", label: "IN-15" },
  { value: "in16", label: "IN-16" },
];

const TELTONIKA_PARAMS = [
  { value: "239", label: "Ignition" },
  { value: "240", label: "Movement" },
  { value: "80", label: "Data Mode" },
  { value: "21", label: "GSM Signal" },
  { value: "200", label: "Sleep Mode" },
  { value: "69", label: "GNSS Status" },
  { value: "181", label: "GNSS PDOP" },
  { value: "182", label: "GNSS HDOP" },
  { value: "66", label: "External Voltage" },
  { value: "24", label: "Speed" },
  { value: "205", label: "GSM Cell ID" },
  { value: "206", label: "GSM Area Code" },
  { value: "67", label: "Battery Voltage" },
  { value: "68", label: "Battery Current" },
  { value: "241", label: "Active GSM Operator" },
  { value: "199", label: "Trip Odometer" },
  { value: "16", label: "Total Odometer" },
  { value: "1", label: "Digital Input 1" },
  { value: "9", label: "Analog Input 1" },
  { value: "179", label: "Digital Output 1" },
  { value: "12", label: "Fuel Used GPS" },
  { value: "13", label: "Fuel Rate GPS" },
  { value: "17", label: "Axis X" },
  { value: "18", label: "Axis Y" },
  { value: "19", label: "Axis Z" },
  { value: "11", label: "ICCID1" },
  { value: "10", label: "SD Status" },
  { value: "2", label: "Digital Input 2" },
  { value: "3", label: "Digital Input 3" },
  { value: "6", label: "Analog Input 2" },
  { value: "180", label: "Digital Output 2" },
  { value: "72", label: "Dallas Temperature 1" },
  { value: "73", label: "Dallas Temperature 2" },
  { value: "74", label: "Dallas Temperature 3" },
  { value: "75", label: "Dallas Temperature 4" },
  { value: "76", label: "Dallas Temperature ID 1" },
  { value: "77", label: "Dallas Temperature ID 2" },
  { value: "79", label: "Dallas Temperature ID 3" },
  { value: "71", label: "Dallas Temperature ID 4" },
  { value: "78", label: "iButton" },
  { value: "207", label: "RFID" },
  { value: "201", label: "LLS 1 Fuel Level" },
  { value: "202", label: "LLS 1 Temperature" },
  { value: "203", label: "LLS 2 Fuel Level" },
  { value: "204", label: "LLS 2 Temperature" },
  { value: "210", label: "LLS 3 Fuel Level" },
  { value: "211", label: "LLS 3 Temperature" },
  { value: "212", label: "LLS 4 Fuel Level" },
  { value: "213", label: "LLS 4 Temperature" },
  { value: "214", label: "LLS 5 Fuel Level" },
  { value: "215", label: "LLS 5 Temperature" },
  { value: "15", label: "Eco Score" },
  { value: "113", label: "Battery Level" },
  { value: "238", label: "User ID" },
  { value: "237", label: "Network Type" },
  { value: "4", label: "Pulse Counter Din1" },
  { value: "5", label: "Pulse Counter Din2" },
  { value: "263", label: "BT Status" },
  { value: "264", label: "Barcode ID" },
  { value: "303", label: "Instant Movement" },
  { value: "327", label: "UL202-02 Sensor Fuel level" },
  { value: "483", label: "UL202-02 Sensor Status" },
  { value: "380", label: "Digital output 3" },
  { value: "381", label: "Ground Sense" },
  { value: "387", label: "ISO6709 Coordinates" },
  { value: "636", label: "UMTS/LTE Cell ID" },
  { value: "403", label: "Driver Name" },
  { value: "404", label: "Driver card license type" },
  { value: "405", label: "Driver Gender" },
  { value: "406", label: "Driver Card ID" },
  { value: "407", label: "Driver card expiration date" },
  { value: "408", label: "Driver Card place of issue" },
  { value: "409", label: "Driver Status Event" },
  { value: "329", label: "AIN Speed" },
  { value: "500", label: "MSP500 vendor name" },
  { value: "501", label: "MSP500 vehicle number" },
  { value: "502", label: "MSP500 speed sensor" },
  { value: "637", label: "Wake Reason" },
  { value: "10800", label: "EYE Temperature 1" },
  { value: "10801", label: "EYE Temperature 2" },
  { value: "10802", label: "EYE Temperature 3" },
  { value: "10803", label: "EYE Temperature 4" },
  { value: "10804", label: "EYE Humidity 1" },
  { value: "10805", label: "EYE Humidity 2" },
  { value: "10806", label: "EYE Humidity 3" },
  { value: "10807", label: "EYE Humidity 4" },
  { value: "10808", label: "EYE Magnet 1" },
  { value: "10809", label: "EYE Magnet 2" },
  { value: "10810", label: "EYE Magnet 3" },
  { value: "10811", label: "EYE Magnet 4" },
  { value: "155", label: "Geofence zone 01" },
  { value: "156", label: "Geofence zone 02" },
  { value: "157", label: "Geofence zone 03" },
  { value: "158", label: "Geofence zone 04" },
  { value: "159", label: "Geofence zone 05" },
  { value: "61", label: "Geofence zone 06" },
  { value: "62", label: "Geofence zone 07" },
  { value: "63", label: "Geofence zone 08" },
  { value: "64", label: "Geofence zone 09" },
  { value: "65", label: "Geofence zone 10" },
  { value: "70", label: "Geofence zone 11" },
  { value: "88", label: "Geofence zone 12" },
  { value: "91", label: "Geofence zone 13" },
  { value: "92", label: "Geofence zone 14" },
  { value: "93", label: "Geofence zone 15" },
  { value: "94", label: "Geofence zone 16" },
  { value: "95", label: "Geofence zone 17" },
  { value: "96", label: "Geofence zone 18" },
  { value: "97", label: "Geofence zone 19" },
  { value: "98", label: "Geofence zone 20" },
  { value: "99", label: "Geofence zone 21" },
  { value: "153", label: "Geofence zone 22" },
  { value: "154", label: "Geofence zone 23" },
  { value: "190", label: "Geofence zone 24" },
  { value: "191", label: "Geofence zone 25" },
  { value: "192", label: "Geofence zone 26" },
  { value: "193", label: "Geofence zone 27" },
  { value: "194", label: "Geofence zone 28" },
  { value: "195", label: "Geofence zone 29" },
  { value: "196", label: "Geofence zone 30" },
  { value: "197", label: "Geofence zone 31" },
  { value: "198", label: "Geofence zone 32" },
  { value: "208", label: "Geofence zone 33" },
  { value: "209", label: "Geofence zone 34" },
  { value: "216", label: "Geofence zone 35" },
  { value: "217", label: "Geofence zone 36" },
  { value: "218", label: "Geofence zone 37" },
  { value: "219", label: "Geofence zone 38" },
  { value: "220", label: "Geofence zone 39" },
  { value: "221", label: "Geofence zone 40" },
  { value: "222", label: "Geofence zone 41" },
  { value: "223", label: "Geofence zone 42" },
  { value: "224", label: "Geofence zone 43" },
  { value: "225", label: "Geofence zone 44" },
  { value: "226", label: "Geofence zone 45" },
  { value: "227", label: "Geofence zone 46" },
  { value: "228", label: "Geofence zone 47" },
  { value: "229", label: "Geofence zone 48" },
  { value: "230", label: "Geofence zone 49" },
  { value: "231", label: "Geofence zone 50" },
  { value: "175", label: "Auto Geofence" },
  { value: "250", label: "Trip" },
  { value: "255", label: "Over Speeding" },
  { value: "257", label: "Crash trace data" },
  { value: "285", label: "Blood alcohol content" },
  { value: "251", label: "Idling" },
  { value: "253", label: "Green driving type" },
  { value: "246", label: "Towing" },
  { value: "252", label: "Unplug" },
  { value: "247", label: "Crash detection" },
  { value: "248", label: "Immobilizer" },
  { value: "254", label: "Green Driving Value" },
  { value: "249", label: "Jamming" },
  { value: "14", label: "ICCID2" },
  { value: "243", label: "Green driving event duration" },
  { value: "236", label: "Alarm" },
  { value: "258", label: "EcoMaximum" },
  { value: "259", label: "EcoAverage" },
  { value: "260", label: "EcoDuration" },
  { value: "283", label: "Driving State" },
  { value: "284", label: "Driving Records" },
  { value: "391", label: "Private mode" },
  { value: "317", label: "Crash event counter" },
  { value: "449", label: "Ignition On Counter" },
  { value: "256", label: "VIN" },
  { value: "30", label: "Number of DTC" },
  { value: "31", label: "Engine Load" },
  { value: "32", label: "Coolant Temperature" },
  { value: "33", label: "Short Fuel Trim" },
  { value: "34", label: "Fuel pressure" },
  { value: "35", label: "Intake MAP" },
  { value: "36", label: "Engine RPM" },
  { value: "37", label: "Vehicle Speed" },
  { value: "38", label: "Timing Advance" },
  { value: "39", label: "Intake Air Temperature" },
  { value: "40", label: "MAF" },
  { value: "41", label: "Throttle Position" },
  { value: "42", label: "Runtime since engine start" },
  { value: "43", label: "Distance Traveled MIL On" },
  { value: "44", label: "Relative Fuel Rail Pressure" },
  { value: "45", label: "Direct Fuel Rail Pressure" },
  { value: "46", label: "Commanded EGR" },
  { value: "47", label: "EGR Error" },
  { value: "48", label: "Fuel Level" },
  { value: "49", label: "Distance Since Codes Clear" },
  { value: "50", label: "Barometic Pressure" },
  { value: "51", label: "Control Module Voltage" },
  { value: "52", label: "Absolute Load Value" },
  { value: "759", label: "Fuel Type" },
  { value: "53", label: "Ambient Air Temperature" },
  { value: "54", label: "Time Run With MIL On" },
  { value: "55", label: "Time Since Codes Cleared" },
  { value: "56", label: "Absolute Fuel Rail Pressure" },
  { value: "57", label: "Hybrid battery pack life" },
  { value: "58", label: "Engine Oil Temperature" },
  { value: "59", label: "Fuel injection timing" },
  { value: "540", label: "Throttle position group" },
  { value: "541", label: "Commanded Equivalence R" },
  { value: "542", label: "Intake MAP 2 bytes" },
  { value: "543", label: "Hybrid System Voltage" },
  { value: "544", label: "Hybrid System Current" },
  { value: "281", label: "Fault Codes" },
  { value: "60", label: "Fuel Rate" },
  { value: "389", label: "OBD OEM Total Mileage" },
  { value: "390", label: "OBD OEM Fuel Level" },
  { value: "402", label: "OEM Distance Until Service" },
  { value: "410", label: "OEM Battery charge state" },
  { value: "411", label: "OEM Battery charge level" },
  { value: "412", label: "OEM Battery power consumption" },
  { value: "755", label: "OEM Remaining distance" },
  { value: "1151", label: "OEM Battery State Of Health" },
  { value: "1152", label: "OEM Battery Temperature" },
  { value: "385", label: "Beacon" },
  { value: "548", label: "Advanced BLE Beacon data" },
  { value: "25", label: "BLE Temperature #1" },
  { value: "26", label: "BLE Temperature #2" },
  { value: "27", label: "BLE Temperature #3" },
  { value: "28", label: "BLE Temperature #4" },
  { value: "29", label: "BLE Battery #1" },
  { value: "20", label: "BLE Battery #2" },
  { value: "22", label: "BLE Battery #3" },
  { value: "23", label: "BLE Battery #4" },
  { value: "86", label: "BLE Humidity #1" },
  { value: "104", label: "BLE Humidity #2" },
  { value: "106", label: "BLE Humidity #3" },
  { value: "108", label: "BLE Humidity #4" },
  { value: "270", label: "BLE Fuel Level #1" },
  { value: "273", label: "BLE Fuel Level #2" },
  { value: "276", label: "BLE Fuel Level #3" },
  { value: "279", label: "BLE Fuel Level #4" },
  { value: "306", label: "BLE Fuel Frequency #1" },
  { value: "307", label: "BLE Fuel Frequency #2" },
  { value: "308", label: "BLE Fuel Frequency #3" },
  { value: "309", label: "BLE Fuel Frequency #4" },
  { value: "335", label: "BLE Luminosity #1" },
  { value: "336", label: "BLE Luminosity #2" },
  { value: "337", label: "BLE Luminosity #3" },
  { value: "338", label: "BLE Luminosity #4" },
  { value: "331", label: "BLE 1 Custom #1" },
  { value: "463", label: "BLE 1 Custom #2" },
  { value: "464", label: "BLE 1 Custom #3" },
  { value: "465", label: "BLE 1 Custom #4" },
  { value: "466", label: "BLE 1 Custom #5" },
  { value: "332", label: "BLE 2 Custom #1" },
  { value: "467", label: "BLE 2 Custom #2" },
  { value: "468", label: "BLE 2 Custom #3" },
  { value: "469", label: "BLE 2 Custom #4" },
  { value: "470", label: "BLE 2 Custom #5" },
  { value: "333", label: "BLE 3 Custom #1" },
  { value: "471", label: "BLE 3 Custom #2" },
  { value: "472", label: "BLE 3 Custom #3" },
  { value: "473", label: "BLE 3 Custom #4" },
  { value: "474", label: "BLE 3 Custom #5" },
  { value: "334", label: "BLE 4 Custom #1" },
  { value: "475", label: "BLE 4 Custom #2" },
  { value: "476", label: "BLE 4 Custom #3" },
  { value: "477", label: "BLE 4 Custom #4" },
  { value: "478", label: "BLE 4 Custom #5" },
  { value: "81", label: "Vehicle Speed" },
  { value: "82", label: "Accelerator Pedal Position" },
  { value: "83", label: "Fuel Consumed" },
  { value: "84", label: "Fuel Level" },
  { value: "85", label: "Engine RPM" },
  { value: "87", label: "Total Mileage" },
  { value: "89", label: "Fuel level" },
  { value: "90", label: "Door Status" },
  { value: "100", label: "Program Number" },
  { value: "101", label: "Module ID 8B" },
  { value: "388", label: "Module ID 17B" },
  { value: "102", label: "Engine Worktime" },
  { value: "103", label: "Engine Worktime (counted)" },
  { value: "105", label: "Total Mileage (counted)" },
  { value: "107", label: "Fuel Consumed (counted)" },
  { value: "110", label: "Fuel Rate" },
  { value: "111", label: "AdBlue Level" },
  { value: "112", label: "AdBlue Level" },
  { value: "114", label: "Engine Load" },
  { value: "115", label: "Engine Temperature" },
  { value: "118", label: "Axle 1 Load" },
  { value: "119", label: "Axle 2 Load" },
  { value: "120", label: "Axle 3 Load" },
  { value: "121", label: "Axle 4 Load" },
  { value: "122", label: "Axle 5 Load" },
  { value: "123", label: "Control State Flags" },
  { value: "124", label: "Agricultural Machinery Flags" },
  { value: "125", label: "Harvesting Time" },
  { value: "126", label: "Area of Harvest" },
  { value: "127", label: "Mowing Efficiency" },
  { value: "128", label: "Grain Mown Volume" },
  { value: "129", label: "Grain Moisture" },
  { value: "130", label: "Harvesting Drum RPM" },
  { value: "131", label: "Gap Under The Harvesting Drum" },
  { value: "132", label: "Security State Flags" },
  { value: "133", label: "Tachograph Total Vehicle Distance" },
  { value: "134", label: "Trip Distance" },
  { value: "135", label: "Tacho Driver Card Presence" },
  { value: "136", label: "Driver 1 States" },
  { value: "137", label: "Driver 2 States" },
  { value: "138", label: "Driver 1 Continuous Driving Time" },
  { value: "139", label: "Driver 2 Continuous Driving Time" },
  { value: "140", label: "Driver 1 Cumulative Break Time" },
  { value: "141", label: "Driver 2 Cumulative Break Time" },
  { value: "142", label: "Driver 1 Selected Activity Duration" },
  { value: "143", label: "Driver 2 Selected Activity Duration" },
  { value: "144", label: "Driver 1 Cumulative Driving Time" },
  { value: "145", label: "Driver 2 Cumulative Driving Time" },
  { value: "146", label: "Driver 1 ID High" },
  { value: "147", label: "Driver 1 ID Low" },
  { value: "148", label: "Driver 2 ID High" },
  { value: "149", label: "Driver 2 ID Low" },
  { value: "151", label: "Battery Temperature" },
  { value: "152", label: "HV Battery Level" },
  { value: "160", label: "DTC Faults" },
  { value: "161", label: "Slope of Arm" },
  { value: "162", label: "Rotation of Arm" },
  { value: "163", label: "Eject of Arm" },
  { value: "164", label: "Horizontal Distance Arm Vehicle" },
  { value: "165", label: "Height Arm Above Ground" },
  { value: "166", label: "Drill RPM" },
  { value: "167", label: "Amount Of Spread Salt Square Meter" },
  { value: "168", label: "Battery Voltage" },
  { value: "169", label: "Amount Of Spread Fine Grained Salt" },
  { value: "170", label: "Amount Of Coarse Grained Salt" },
  { value: "171", label: "Amount Of Spread DiMix" },
  { value: "172", label: "Amount Of Spread Coarse Grained Calcium" },
  { value: "173", label: "Amount Of Spread Calcium Chloride" },
  { value: "174", label: "Amount Of Spread Sodium Chloride" },
  { value: "176", label: "Amount Of Spread Magnesium Chloride" },
  { value: "177", label: "Amount Of Spread Gravel" },
  { value: "178", label: "Amount Of Spread Sand" },
  { value: "183", label: "Width Pouring Left" },
  { value: "184", label: "Width Pouring Right" },
  { value: "185", label: "Salt Spreader Working Hours" },
  { value: "186", label: "Distance During Salting" },
  { value: "187", label: "Load Weight" },
  { value: "188", label: "Retarder Load" },
  { value: "189", label: "Cruise Time" },
  { value: "232", label: "CNG Status" },
  { value: "233", label: "CNG Used" },
  { value: "234", label: "CNG Level" },
  { value: "235", label: "Oil Level" },
  { value: "304", label: "Vehicles Range On Battery" },
  { value: "305", label: "Vehicles Range On Additional Fuel" },
  { value: "325", label: "VIN" },
  { value: "282", label: "Fault Codes" },
  { value: "517", label: "Security State Flags P4" },
  { value: "518", label: "Control State Flags P4" },
  { value: "519", label: "Indicator State Flags P4" },
  { value: "520", label: "Agricultural State Flags P4" },
  { value: "521", label: "Utility State Flags P4" },
  { value: "522", label: "Cistern State Flags P4" },
  { value: "855", label: "LNG Used" },
  { value: "856", label: "LNG Used (counted)" },
  { value: "857", label: "LNG Level" },
  { value: "858", label: "LNG Level" },
  { value: "1100", label: "Total LPG Used" },
  { value: "1101", label: "Total LPG Used Counted" },
  { value: "1102", label: "LPG Level Proc" },
  { value: "1103", label: "LPG Level Liters" },
  { value: "898", label: "SSF Ignition" },
  { value: "652", label: "SSF KeyInIgnitionLock" },
  { value: "899", label: "SSF Webasto" },
  { value: "900", label: "SSF Engine Working" },
  { value: "901", label: "SSF Standalone Engine" },
  { value: "902", label: "SSF Ready To Drive" },
  { value: "903", label: "SSF Engine Working On CNG" },
  { value: "904", label: "SSF Work Mode" },
  { value: "905", label: "SSF Operator" },
  { value: "906", label: "SSF Interlock" },
  { value: "907", label: "SSF Engine Lock Active" },
  { value: "908", label: "SSF Request To Lock Engine" },
  { value: "653", label: "SSF Handbrake Is Active" },
  { value: "910", label: "SSF Footbrake Is Active" },
  { value: "911", label: "SSF Clutch Pushed" },
  { value: "912", label: "SSF Hazard Warning Lights" },
  { value: "654", label: "SSF Front Left Door Open" },
  { value: "655", label: "SSF Front Right Door Open" },
  { value: "656", label: "SSF Rear Left Door Open" },
  { value: "657", label: "SSF Rear Right Door Open" },
  { value: "658", label: "SSF Trunk Door Open" },
  { value: "913", label: "SSF Engine Cover Open" },
  { value: "909", label: "SSF Roof Open" },
  { value: "914", label: "SSF Charging Wire Plugged" },
  { value: "915", label: "SSF Batttery Charging" },
  { value: "916", label: "SSF Electric Engine State" },
  { value: "917", label: "SSF Car Closed Factory Remote" },
  { value: "662", label: "SSF Car Is Closed" },
  { value: "918", label: "SSF Factory Alarm Actuated" },
  { value: "919", label: "SSF Factory Alarm Emulated" },
  { value: "920", label: "SSF Signal Close Factory Remote" },
  { value: "921", label: "SSF Signal Open Factory Remote" },
  { value: "922", label: "SSF Rearming Signal" },
  { value: "923", label: "SSF Trunk Door Opened Factory Remote" },
  { value: "924", label: "SSF CAN Module In Sleep" },
  { value: "925", label: "SSF Factory Remote 3x" },
  { value: "926", label: "SSF Factory Armed" },
  { value: "660", label: "SSF Parking Gear Active (automatic gear box)" },
  { value: "661", label: "SSF Reverse Gear Active" },
  { value: "659", label: "SSF Neutral Gear Active (automatic gear box)" },
  { value: "927", label: "SSF Drive Is Active (automatic gear box)" },
  { value: "1083", label: "SSF Engine Working On Dual Fuel" },
  { value: "1084", label: "SSF Engine Working On LPG" },
  { value: "928", label: "CSF Parking Lights" },
  { value: "929", label: "CSF Dipped Head lights" },
  { value: "930", label: "CSF Full Beam Headlights" },
  { value: "931", label: "CSF Rear Fog Lights" },
  { value: "932", label: "CSF Front Fog Lights" },
  { value: "933", label: "CSF Additional Front Lights" },
  { value: "934", label: "CSF Additional Rear Lights" },
  { value: "935", label: "CSF Light Signal" },
  { value: "936", label: "CSF Air Conditioning" },
  { value: "937", label: "CSF Cruise Control" },
  { value: "938", label: "CSF Automatic Retarder" },
  { value: "939", label: "CSF Manual Retarder" },
  { value: "940", label: "CSF Driver's Seatbelt Fastened" },
  { value: "941", label: "CSF Front Driver's Seatbelt Fastened" },
  { value: "942", label: "CSF Left Driver's Seatbelt Fastened" },
  { value: "943", label: "CSF Right Driver's Seatbelt Fastened" },
  { value: "944", label: "CSF Centre Driver's Seatbelt Fastened" },
  { value: "945", label: "CSF Front Passenger Present" },
  { value: "946", label: "CSF PTO" },
  { value: "947", label: "CSF Front Differential Locked" },
  { value: "948", label: "CSF Rear Differential Locked" },
  { value: "949", label: "CSF Central Differential 4HI Locked" },
  { value: "950", label: "CSF Rear Differential 4LO Locked" },
  { value: "951", label: "CSF Trailer Axle 1 Lift Active" },
  { value: "952", label: "CSF Trailer Axle 2 Lift Active" },
  { value: "1085", label: "CSF Trailer Connected" },
  { value: "1086", label: "CSF Start Stop System Inactive" },
  { value: "953", label: "ISF Check Engine Indicator" },
  { value: "954", label: "ISF ABS Indicator" },
  { value: "955", label: "ISF ESP Indicator" },
  { value: "956", label: "ISF ESP Turned Off" },
  { value: "957", label: "ISF Stop Indicator" },
  { value: "958", label: "ISF Oil Level Indicator" },
  { value: "959", label: "ISF Coolant liquid level" },
  { value: "960", label: "ISF Battery Not Charging Indicator" },
  { value: "961", label: "ISF Handbrake System Indicator" },
  { value: "962", label: "ISF AIRBAG Indicator" },
  { value: "963", label: "ISF EPS Indicator" },
  { value: "964", label: "ISF Warning Indicator" },
  { value: "965", label: "ISF Lights Failure Indicator" },
  { value: "966", label: "ISF Low Tire Pressure Indicator" },
  { value: "967", label: "ISF Wear Of Brake Pads Indicator" },
  { value: "968", label: "ISF Low Fuel Level Indicator" },
  { value: "969", label: "ISF Maintenence required Indicator" },
  { value: "970", label: "ISF Glow Plug Indicator" },
  { value: "971", label: "ISF FAP Indicator" },
  { value: "972", label: "ISF EPC (Electronic Power Control) Indicator" },
  { value: "973", label: "ISF Clogged Engine Oil Filter Indicator" },
  { value: "974", label: "ISF Low Engine Oil Pressure Indicator" },
  { value: "975", label: "ISF Too High Engine Oil Temperature Indicator" },
  { value: "976", label: "ISF Low Coolant Level Indicator" },
  { value: "977", label: "ISF Clogged Hydraulic System Oil filter Indicator" },
  { value: "978", label: "ISF Hydraulic System Low Pressure Indicator" },
  { value: "979", label: "ISF Hydraulic Oil Low Level Indicator" },
  { value: "980", label: "ISF Hydraulic System High Temperature Indicator" },
  { value: "981", label: "ISF Oil Overflow In Hydraulic Chamber Indicator" },
  { value: "982", label: "ISF Clogged Air Filter Indicator" },
  { value: "983", label: "ISF Clogged Fuel Filter Indicator" },
  { value: "984", label: "ISF Water in Fuel Indicator" },
  { value: "985", label: "ISF Clogged Brake System Filter Indicator" },
  { value: "986", label: "ISF Low Washer Fluid Level Indicator" },
  { value: "987", label: "ISF Low AdBlue Level Indicator" },
  { value: "988", label: "ISF Low Trailer Tyre Pressure Indicator" },
  { value: "989", label: "ISF Wear Of Trailer Brake Lining Indicator" },
  { value: "990", label: "ISF High Trailer Brake Temperature Indicator" },
  { value: "991", label: "ISF Incorrect Trailer Pneumatic Supply Indicator" },
  { value: "992", label: "ISF Low CNG Level Indicator" },
  { value: "993", label: "ASF Right Joystick Moved Right Active" },
  { value: "994", label: "ASF Right Joystick Moved Left Active" },
  { value: "995", label: "ASF Right Joystick Moved Forward Active" },
  { value: "996", label: "ASF Right Joystick Moved Back Active" },
  { value: "997", label: "ASF Left Joystick Moved Right Active" },
  { value: "998", label: "ASF Left Joystick Moved Left Active" },
  { value: "999", label: "ASF Left Joystick Moved Forward Active" },
  { value: "1000", label: "ASF Left Joystick Moved Back Active" },
  { value: "1001", label: "ASF First Rear hydraulic" },
  { value: "1002", label: "ASF Second Rear hydraulic" },
  { value: "1003", label: "ASF Third Rear hydraulic" },
  { value: "1004", label: "ASF Fourth Rear hydraulic" },
  { value: "1005", label: "ASF First Front hydraulic" },
  { value: "1006", label: "ASF Second Front hydraulic" },
  { value: "1007", label: "ASF Third Front hydraulic" },
  { value: "1008", label: "ASF Fourth Front hydraulic" },
  { value: "1009", label: "ASF Front Three-point Hitch" },
  { value: "1010", label: "ASF Rear Three-point Hitch" },
  { value: "1011", label: "ASF Front Power Take-off" },
  { value: "1012", label: "ASF Rear Power Take-off" },
  { value: "1013", label: "ASF Mowing Active" },
  { value: "1014", label: "ASF Threshing Active" },
  { value: "1015", label: "ASF Grain Release From Hopper" },
  { value: "1016", label: "ASF Grain Tank Is 100% Full" },
  { value: "1017", label: "ASF Grain Tank Is 70% Full" },
  { value: "1018", label: "ASF Grain Tank Is Opened" },
  { value: "1019", label: "ASF Unloader Drive" },
  { value: "1020", label: "ASF Cleaning Fan Control Turned Off" },
  { value: "1021", label: "ASF Threshing Drum Control Turned Off" },
  { value: "1022", label: "ASF Straw Walker Is Clogged" },
  { value: "1023", label: "ASF Excessive Clearance Under The Threshing Drum" },
  { value: "1024", label: "ASF Low Temperature Of Drive System Hydraulics Less Than 5 Grades" },
  { value: "1025", label: "ASF High Temperature Of Drive System Hydraulics Greater Than 86 Grades" },
  { value: "1026", label: "ASF Ear Auger Speed Below The Norm" },
  { value: "1027", label: "ASF Grain Auger Speed Below The Norm" },
  { value: "1028", label: "ASF Straw Chooper Speed Below The Norm" },
  { value: "1029", label: "ASF Straw Shaker Speed Below The Norm" },
  { value: "1030", label: "ASF Feeder Speed Below The Norm" },
  { value: "1031", label: "ASF Straw Chopper Switched On" },
  { value: "1032", label: "ASF Corn Header Connected" },
  { value: "1033", label: "ASF Grain Header Connected" },
  { value: "1034", label: "ASF Feeder Reverse Switched On" },
  { value: "1035", label: "ASF The Pressure Filter Of The Hydraulic Pump Is Clogged" },
  { value: "1036", label: "USF Spreading" },
  { value: "1037", label: "USF Pouring Chemicals" },
  { value: "1038", label: "USF Conveyor Belt" },
  { value: "1039", label: "USF Salt Spreader's Drive Wheel" },
  { value: "1040", label: "USF Brushes" },
  { value: "1041", label: "USF Vacuum Cleaner" },
  { value: "1042", label: "USF Water Supply" },
  { value: "1043", label: "USF Spreading" },
  { value: "1044", label: "USF Liquid pump" },
  { value: "1045", label: "USF Unloading From The Hopper" },
  { value: "1046", label: "USF Low Salt (Sand) Level In Container Indicator" },
  { value: "1047", label: "USF Low Water Level in Container Indicator" },
  { value: "1048", label: "USF Chemicals" },
  { value: "1049", label: "USF Compressor" },
  { value: "1050", label: "USF Water Valve Is Opened" },
  { value: "1051", label: "USF Cabin Moved Up Status Active" },
  { value: "1052", label: "USF Cabin Moved Down Status Active" },
  { value: "1099", label: "USF Hydraulics Work Not Permitted" },
  { value: "1053", label: "CiSF Section 1 Presence Of Fluid In The Downpipe" },
  { value: "1054", label: "CiSF Section 1 Filled" },
  { value: "1055", label: "CiSF Section 1 Overfilled" },
  { value: "1056", label: "CiSF Section 2 Presence Of Fluid In The Downpipe" },
  { value: "1057", label: "CiSF Section 2 Filled" },
  { value: "1058", label: "CiSF Section 2 Overfilled" },
  { value: "1059", label: "CiSF Section 3 Presence Of Fluid In The Downpipe" },
  { value: "1060", label: "CiSF Section 3 Filled" },
  { value: "1061", label: "CiSF Section 3 Overfilled" },
  { value: "1062", label: "CiSF Section 4 Presence Of Fluid In The Downpipe" },
  { value: "1063", label: "CiSF Section 4 Filled" },
  { value: "1064", label: "CiSF Section 4 Overfilled" },
  { value: "1065", label: "CiSF Section 5 Presence Of Fluid In The Downpipe" },
  { value: "1066", label: "CiSF Section 5 Filled" },
  { value: "1067", label: "CiSF Section 5 Overfilled" },
  { value: "1068", label: "CiSF Section 6 Presence Of Fluid In The Downpipe" },
  { value: "1069", label: "CiSF Section 6 Filled" },
  { value: "1070", label: "CiSF Section 6 Overfilled" },
  { value: "1071", label: "CiSF Section 7 Presence Of Fluid In The Downpipe" },
  { value: "1072", label: "CiSF Section 7 Filled" },
  { value: "1073", label: "CiSF Section 7 Overfilled" },
  { value: "1074", label: "CiSF Section 8 Presence Of Fluid In The Downpipe" },
  { value: "1075", label: "CiSF Section 8 Filled" },
  { value: "1076", label: "CiSF Section 8 Overfilled" },
  { value: "400", label: "Distance to Next Service" },
  { value: "450", label: "CNG Level Kg" },
  { value: "859", label: "Distance from need of service" },
  { value: "860", label: "Distance from last service" },
  { value: "861", label: "Time to next service" },
  { value: "862", label: "Time from need of service" },
  { value: "863", label: "Time from last serivce" },
  { value: "864", label: "Distance to next oil service" },
  { value: "865", label: "Time to next oil service" },
  { value: "866", label: "LVCAN Vehicle Range" },
  { value: "867", label: "LVCAN Total CNG counted" },
  { value: "1079", label: "Total Bale Count" },
  { value: "1080", label: "Bale Count" },
  { value: "1081", label: "Cut Bale Count" },
  { value: "1082", label: "Bale Slices" },
  { value: "1116", label: "LVCAN MaxRoadSpeed" },
  { value: "1117", label: "LVCAN ExceededRoadSpeed" },
  { value: "1205", label: "LVCAN RSF SpeedLimitSign" },
  { value: "1206", label: "LVCAN RSF EndOfSpeedLimitSign" },
  { value: "1207", label: "LVCAN RSF SpeedExceeded" },
  { value: "1208", label: "LVCAN RSF TimeSpeedLimitSign" },
  { value: "1209", label: "LVCAN RSF WthrSpeedLimitSign" },
];

const OTHER_IOT_PARAMS = [
  { value: "coolant_temp", label: "coolant_temp" },
  { value: "oil_pressure", label: "oil_pressure" },
  { value: "throttle_pos", label: "throttle_pos" },
  { value: "odometer", label: "odometer" },
  { value: "can_bus_data", label: "can_bus_data" },
  { value: "obd_fault_code", label: "obd_fault_code" },
  { value: "driver_id", label: "driver_id" },
  { value: "driver_code_reversed", label: "driver_code_reversed" },
  { value: "vin", label: "vin" },
  { value: "vin2", label: "vin2" },
  { value: "id_code", label: "id_code" },
  { value: "geofence_id", label: "geofence_id" },
  { value: "overspeed_event", label: "overspeed_event" },
  { value: "harsh_accel", label: "harsh_accel" },
  { value: "harsh_brake", label: "harsh_brake" },
  { value: "harsh_corner", label: "harsh_corner" },
  { value: "rollover", label: "rollover" },
  { value: "crash_event", label: "crash_event" },
  { value: "panic_button", label: "panic_button" },
  { value: "sos_alarm", label: "sos_alarm" },
  { value: "towing_alarm", label: "towing_alarm" },
  { value: "vibration_alarm", label: "vibration_alarm" },
  { value: "tamper_alarm", label: "tamper_alarm" },
  { value: "temperature_sensor", label: "temperature_sensor" },
  { value: "h1w_temp_x_y", label: "h1w_temp_x_y" },
  { value: "humidity", label: "humidity" },
  { value: "ambient_light", label: "ambient_light" },
  { value: "tire_number", label: "tire_number" },
  { value: "tire_pressure_val", label: "tire_pressure_val" },
  { value: "tire_temp", label: "tire_temp" },
  { value: "tire_battery_abnormal", label: "tire_battery_abnormal" },
  { value: "tire_low_pressure", label: "tire_low_pressure" },
  { value: "tire_high_pressure", label: "tire_high_pressure" },
  { value: "tire_signal_loss", label: "tire_signal_loss" },
  { value: "cargo_door_status", label: "cargo_door_status" },
  { value: "trailer_id", label: "trailer_id" },
  { value: "load_weight", label: "load_weight" },
  { value: "io_N", label: "io_N" },
  { value: "name", label: "name" },
  { value: "company_id", label: "company_id" },
  { value: "rfid_card_id", label: "rfid_card_id" },
  { value: "fingerprint_id", label: "fingerprint_id" },
  { value: "face_id", label: "face_id" },
  { value: "man_down", label: "man_down" },
  { value: "job_code", label: "job_code" },
  { value: "check_in", label: "check_in" },
  { value: "check_out", label: "check_out" },
  { value: "wearable_temp", label: "wearable_temp" },
  { value: "hr_heart_rate", label: "hr_heart_rate" },
  { value: "hr_spo2", label: "hr_spo2" },
  { value: "hr_steps", label: "hr_steps" },
  { value: "hr_fatigue_index", label: "hr_fatigue_index" },
  { value: "package_id", label: "package_id" },
  { value: "pallet_id", label: "pallet_id" },
  { value: "container_id", label: "container_id" },
  { value: "shipment_ref", label: "shipment_ref" },
  { value: "cargo_temp", label: "cargo_temp" },
  { value: "cargo_humidity", label: "cargo_humidity" },
  { value: "cargo_shock", label: "cargo_shock" },
  { value: "cargo_tilt", label: "cargo_tilt" },
  { value: "cargo_light", label: "cargo_light" },
  { value: "tamper_alarm_goods", label: "tamper_alarm_goods" },
  { value: "delivery_status", label: "delivery_status" },
  { value: "proof_of_delivery", label: "proof_of_delivery" },
  { value: "chain_of_custody", label: "chain_of_custody" },
  { value: "iot_sensor_id", label: "iot_sensor_id" },
  { value: "iot_device_type", label: "iot_device_type" },
  { value: "air_quality_index", label: "air_quality_index" },
  { value: "co2_level", label: "co2_level" },
  { value: "voc_level", label: "voc_level" },
  { value: "noise_level", label: "noise_level" },
  { value: "water_flow", label: "water_flow" },
  { value: "water_leak", label: "water_leak" },
  { value: "soil_moisture", label: "soil_moisture" },
  { value: "soil_temp", label: "soil_temp" },
  { value: "light_intensity", label: "light_intensity" },
  { value: "motion_detected", label: "motion_detected" },
  { value: "proximity", label: "proximity" },
  { value: "rfid_tag", label: "rfid_tag" },
  { value: "door_sensor", label: "door_sensor" },
  { value: "window_sensor", label: "window_sensor" },
  { value: "glass_break", label: "glass_break" },
  { value: "motion_sensor", label: "motion_sensor" },
  { value: "camera_stream", label: "camera_stream" },
  { value: "camera_snapshot", label: "camera_snapshot" },
  { value: "door_lock_status", label: "door_lock_status" },
  { value: "alarm_status", label: "alarm_status" },
  { value: "fire_alarm", label: "fire_alarm" },
  { value: "smoke_level", label: "smoke_level" },
  { value: "co_level", label: "co_level" },
  { value: "gas_leak", label: "gas_leak" },
  { value: "flood_sensor", label: "flood_sensor" },
  { value: "cctv_id", label: "cctv_id" },
  { value: "camera_id", label: "camera_id" },
  { value: "video_stream", label: "video_stream" },
  { value: "video_snapshot", label: "video_snapshot" },
  { value: "video_channel", label: "video_channel" },
  { value: "storage_status", label: "storage_status" },
  { value: "bandwidth_usage", label: "bandwidth_usage" },
  { value: "video_event", label: "video_event" },
  { value: "ai_object_detected", label: "ai_object_detected" },
  { value: "lane_departure", label: "lane_departure" },
  { value: "forward_collision", label: "forward_collision" },
  { value: "headway_monitor", label: "headway_monitor" },
  { value: "pedestrian_detected", label: "pedestrian_detected" },
  { value: "speed_limit_sign", label: "speed_limit_sign" },
  { value: "traffic_light_status", label: "traffic_light_status" },
  { value: "driver_face_id", label: "driver_face_id" },
  { value: "eye_closure", label: "eye_closure" },
  { value: "yawning", label: "yawning" },
  { value: "distraction", label: "distraction" },
  { value: "seatbelt_status", label: "seatbelt_status" },
  { value: "smoking_detected", label: "smoking_detected" },
  { value: "blind_spot_left", label: "blind_spot_left" },
  { value: "blind_spot_right", label: "blind_spot_right" },
  { value: "lane_change_alert", label: "lane_change_alert" },
  { value: "passenger_count", label: "passenger_count" },
  { value: "boarding_event", label: "boarding_event" },
  { value: "alighting_event", label: "alighting_event" },
  { value: "seat_occupancy", label: "seat_occupancy" },
  { value: "crowding_level", label: "crowding_level" },
];

const LEDGER = [
  { ts:"20:25:38", tenant:"Kampala_Boda_Fleet", event:"contact_reveal",   token:"BODA_LEAD_UNLOCK", d:"-1", actor:"finance@navas",   source:"api"    },
  { ts:"20:22:38", tenant:"Kampala_Boda_Fleet", event:"listing_view",     token:"LISTING_VIEW",     d:"-1", actor:"waswa-agent",     source:"worker" },
  { ts:"20:19:38", tenant:"Kampala_Boda_Fleet", event:"payout_initiate",  token:"PAYOUT_TX",        d:"-3", actor:"sysadmin@navas",  source:"kafka"  },
  { ts:"20:16:38", tenant:"Kampala_Boda_Fleet", event:"chat_msg",         token:"CHAT_PREPAY",      d:"-1", actor:"sysadmin@navas",  source:"api"    },
  { ts:"20:13:38", tenant:"Kampala_Boda_Fleet", event:"booking_confirm",  token:"VEBA_BOOK_FEE",    d:"-1", actor:"sysadmin@navas",  source:"api"    },
  { ts:"20:10:38", tenant:"Kampala_Boda_Fleet", event:"payout_initiate",  token:"PAYOUT_TX",        d:"-2", actor:"waswa-agent",     source:"api"    },
  { ts:"20:07:38", tenant:"Kampala_Boda_Fleet", event:"contact_reveal",   token:"BODA_LEAD_UNLOCK", d:"-1", actor:"waswa-agent",     source:"kafka"  },
  { ts:"20:04:38", tenant:"Kampala_Boda_Fleet", event:"payout_initiate",  token:"PAYOUT_TX",        d:"-1", actor:"sysadmin@navas",  source:"api"    },
  { ts:"20:01:38", tenant:"Kampala_Boda_Fleet", event:"contact_reveal",   token:"BODA_LEAD_UNLOCK", d:"-3", actor:"finance@navas",   source:"worker" },
];

const FIFO = [
  { asset:"BODA-UG-1182",  bundle:"VEBA_10K",  remain:"3,120", next:"2h 10m" },
  { asset:"CAR-KE-8841",   bundle:"GPS_30D",   remain:"17d",   next:"17d"    },
  { asset:"D8-KE-0093",    bundle:"POH_2K",    remain:"880",   next:"46m"    },
  { asset:"AMB-UG-0411",   bundle:"GPS_30D",   remain:"24d",   next:"24d"    },
  { asset:"Piki-UG-4402",  bundle:"DRIVE_EVT", remain:"210",   next:"—"      },
  { asset:"Reefer-KE-2020",bundle:"COLD_1D",   remain:"8h",    next:"8h"     },
];

const SUSPECTS = [
  { id:"hirer_0912",  risk:"0.82", detail:"14 views • 0 pays"       },
  { id:"owner_4420",  risk:"0.77", detail:"6 chats • 0 bookings"    },
  { id:"broker_1201", risk:"0.73", detail:"contact share patterns"   },
];

const PROCESSES = [
  { name:"python-sockets",  cpu:46, ram:38, state:"OK"   },
  { name:"flask-api",       cpu:21, ram:24, state:"OK"   },
  { name:"kafka-consumer",  cpu:34, ram:42, state:"OK"   },
  { name:"cassandra",       cpu:58, ram:61, state:"WARN" },
  { name:"redis-cache",     cpu:12, ram:18, state:"OK"   },
  { name:"waswa-ml-worker", cpu:72, ram:55, state:"WARN" },
];

const VERSIONS = [
  { ver:"v12", token:"BODA_LEAD_UNLOCK", change:"UGX 450→500",  by:"sysadmin", state:"HITL"     },
  { ver:"v11", token:"GPS_TIME_HR",      change:"hour rate -5%", by:"finance",  state:"Approved" },
  { ver:"v10", token:"VIDEO_SNAPSHOT",   change:"enable KE",     by:"product",  state:"Pending"  },
  { ver:"v9",  token:"FUEL_THEFT_EVT",   change:"RPS 9.5→9.7",  by:"product",  state:"Approved" },
  { ver:"v8",  token:"ROAMING_PACKET",   change:"TZS added",     by:"finance",  state:"Approved" },
];

const TRASH_ITEMS = [
  { object:"TOKEN:AI_DEEP_AUDIT", type:"Token",  by:"product",  age:"2d"  },
  { object:"RULE:CAP_OLIWA",      type:"Rule",   by:"sysadmin", age:"6h"  },
  { object:"BUNDLE:VEBA_1K",      type:"Bundle", by:"finance",  age:"8d"  },
  { object:"TOKEN:CALL_MASK",     type:"Token",  by:"sysadmin", age:"14d" },
];

const AUDIT = [
  { ts:"2026-02-22 20:25", actor:"waswa-agent",     action:"EXPORT_CSV",     object:"CAP_DAILY",        result:"DENY", hash:"45a54ec860e1" },
  { ts:"2026-02-22 20:18", actor:"sysadmin@navas",  action:"PRICE_REQUEST",  object:"CAP_DAILY",        result:"HITL", hash:"6fe75b41b5ff" },
  { ts:"2026-02-22 20:11", actor:"sysadmin@navas",  action:"RESTORE_TRASH",  object:"BODA_LEAD_UNLOCK", result:"HITL", hash:"577ef4ad8e22" },
  { ts:"2026-02-22 20:04", actor:"finance@navas",   action:"EXPORT_CSV",     object:"VEBA_10K",         result:"HITL", hash:"71db9759b0fe" },
  { ts:"2026-02-22 19:57", actor:"waswa-agent",     action:"EXPORT_CSV",     object:"BODA_LEAD_UNLOCK", result:"OK",   hash:"efcfb5f937d7" },
];

const MODAL_PARAMS = [
  { param:"booking_contact_reveal", origin:"VEBA", rps:"9.9", bill:"Yes", state:"ON"   },
  { param:"call_masking_proxy",     origin:"CORE", rps:"9.1", bill:"Yes", state:"ON"   },
  { param:"chat_message_prepay",    origin:"VEBA", rps:"8.6", bill:"Yes", state:"ON"   },
  { param:"listing_view",           origin:"VEBA", rps:"8.3", bill:"Yes", state:"ON"   },
  { param:"payout_initiate",        origin:"PAY",  rps:"9.6", bill:"Yes", state:"HIC"  },
  { param:"refund_dispute",         origin:"PAY",  rps:"9.0", bill:"Yes", state:"HITL" },
  { param:"kyc_verify",             origin:"VEBA", rps:"8.7", bill:"Yes", state:"ON"   },
];

// ─── Token type → icon/colour metadata (Explorer-style file icons) ───────────
const TOKEN_TYPE_META: Record<string, { icon: string; tint: string; text: string }> = {
  time:        { icon: "⏱",  tint: "bg-[#128C7E]/10", text: "text-[#0E7A6D]" },
  parameter:   { icon: "⚙",  tint: "bg-[#34B7F1]/10", text: "text-[#1E88B5]" },
  event:       { icon: "⚡", tint: "bg-[#F97316]/10", text: "text-[#C2570B]" },
  volume:      { icon: "🛢", tint: "bg-[#3B82F6]/10", text: "text-[#2563EB]" },
  distance:    { icon: "📏", tint: "bg-[#8B5CF6]/10", text: "text-[#7C3AED]" },
  video:       { icon: "🎬", tint: "bg-[#EF4444]/10", text: "text-[#DC2626]" },
  conditional: { icon: "🔀", tint: "bg-[#F59E0B]/10", text: "text-[#B45309]" },
  action:      { icon: "⌘",  tint: "bg-[#0EA5E9]/10", text: "text-[#0284C7]" },
  compliance:  { icon: "📋", tint: "bg-[#10B981]/10", text: "text-[#059669]" },
};
function tokenMeta(type?: string) {
  return TOKEN_TYPE_META[(type || "").toLowerCase()] || { icon: "🎫", tint: "bg-[#E9EDEF]", text: "text-[#667781]" };
}

// ─── Explorer "View" menu options + per-view layout config ────────────────────
type TokenView = "xl" | "large" | "medium" | "small" | "list" | "details" | "tiles" | "content";

const TOKEN_VIEW_OPTIONS: { key: TokenView; label: string; glyph: string }[] = [
  { key: "xl",      label: "Extra large icons", glyph: "▦" },
  { key: "large",   label: "Large icons",       glyph: "▦" },
  { key: "medium",  label: "Medium icons",      glyph: "▧" },
  { key: "small",   label: "Small icons",       glyph: "▤" },
  { key: "list",    label: "List",              glyph: "≣" },
  { key: "details", label: "Details",           glyph: "☰" },
  { key: "tiles",   label: "Tiles",             glyph: "◨" },
  { key: "content", label: "Content",           glyph: "▭" },
];

const TOKEN_VIEW_GRID: Record<TokenView, string> = {
  xl:      "[grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]",
  large:   "[grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]",
  medium:  "[grid-template-columns:repeat(auto-fill,minmax(120px,1fr))]",
  small:   "[grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]",
  list:    "[grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]",
  tiles:   "[grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]",
  content: "grid-cols-1",
  details: "",
};

const TOKEN_ICON_SIZE: Record<TokenView, { box: string; text: string }> = {
  xl:      { box: "w-20 h-20", text: "text-[42px]" },
  large:   { box: "w-16 h-16", text: "text-[32px]" },
  medium:  { box: "w-12 h-12", text: "text-[24px]" },
  small:   { box: "w-7 h-7",   text: "text-[14px]" },
  list:    { box: "w-6 h-6",   text: "text-[12px]" },
  tiles:   { box: "w-11 h-11", text: "text-[22px]" },
  content: { box: "w-12 h-12", text: "text-[24px]" },
  details: { box: "w-8 h-8",   text: "text-[15px]" },
};

// ─── Page ────────────────────────────────────────────────────────────────────
export function TokensPage() {
  const [selected, setSelected] = useState("BODA_LEAD_UNLOCK");
  const [createBladeOpen, setCreateBladeOpen] = useState(false);

  // Statistics state
  const [stats, setStats] = useState({
    runningTokens: 0,
    expiredTokens: 0,
    activeVebaTokens: 0,
    expiredVebaTokens: 0,
    totalActiveTokens: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Tokens list state
  const [tokens, setTokens] = useState<any[]>([]);
  const [tokensLoading, setTokensLoading] = useState(true);

  // Explorer-style listing controls
  const [tokenView, setTokenView] = useState<TokenView>("details");
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [tokenSearch, setTokenSearch] = useState("");
  const [tokenSort, setTokenSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "date_created", dir: "desc" });
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);

  // Create token form state
  const [createForm, setCreateForm] = useState({
    token_name: "",
    token_type: "",
    token_amount: "",
    token_currency: "",
    token_validity: "",
    parameters: [] as string[],
  });
  const [createLoading, setCreateLoading] = useState(false);

  // Token details/edit state
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [sideBladeOpen, setSideBladeOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    token_name: "",
    token_type: "",
    token_amount: "",
    token_currency: "UGX",
    token_validity: "",
    parameters: [] as string[],
  });
  const [editLoading, setEditLoading] = useState(false);

  const handleCreateToken = async () => {
    if (!createForm.token_name || !createForm.token_type || !createForm.token_amount || !createForm.token_currency) {
      alert("Please fill in all required fields");
      return;
    }

    setCreateLoading(true);
    try {
      // API expects wrapper object under `data` just like the PHP version
      const payload = {
        data: {
          token_name: createForm.token_name,
          token_type: createForm.token_type,
          token_amount: createForm.token_amount,
          token_currency: createForm.token_currency,
          token_validity: createForm.token_validity || "",
          token_parameters: createForm.parameters,
        },
      };

      const response = await post<any>(ENDPOINTS.TOKENS.CREATE, payload);

      if (response.status === "success") {
        // Reset form
        setCreateForm({
          token_name: "",
          token_type: "",
          token_amount: "",
          token_currency: "UGX",
          token_validity: "",
          parameters: [],
        });
        setCreateBladeOpen(false);
        // Refresh tokens list
        fetchTokens();
      }
    } catch (error) {
      console.error("Failed to create token:", error);
      alert("Failed to create token. Please try again.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleViewToken = async (tokenId: string) => {
    try {
      const data = await getRaw<{ data: any }>(`${ENDPOINTS.TOKENS.BY_ID}/${tokenId}`);
      setSelectedToken(data.data);
      setEditMode(false);
      setSideBladeOpen(true);
    } catch (error) {
      console.error("Failed to fetch token details:", error);
      alert("Failed to load token details");
    }
  };

  const handleEditToken = async (tokenId: string) => {
    try {
      const data = await getRaw<{ data: any }>(`${ENDPOINTS.TOKENS.BY_ID}/${tokenId}`);
      const token = data.data;
      setSelectedToken(token);
      setEditForm({
        token_name: token.token_name,
        token_type: token.token_type,
        token_amount: token.token_amount,
        token_currency: token.token_currency,
        token_validity: token.token_validity,
        parameters: token.token_parameters || [],
      });
      setEditMode(true);
      setSideBladeOpen(true);
    } catch (error) {
      console.error("Failed to fetch token details:", error);
      alert("Failed to load token details");
    }
  };

  const handleUpdateToken = async () => {
    if (!editForm.token_name || !editForm.token_type || !editForm.token_amount) {
      alert("Please fill in all required fields");
      return;
    }

    setEditLoading(true);
    try {
      const payload = {
        data: {
          token_name: editForm.token_name,
          token_type: editForm.token_type,
          token_amount: editForm.token_amount,
          token_currency: editForm.token_currency,
          token_validity: editForm.token_validity,
          token_parameters: editForm.parameters,
        }
      };

      await put<any>(`${ENDPOINTS.TOKENS.BY_ID}/${selectedToken.token_id}`, payload);
      setSideBladeOpen(false);
      setSelectedToken(null);
      setEditMode(false);
      // Refresh tokens list
      fetchTokens();
    } catch (error) {
      console.error("Failed to update token:", error);
      alert("Failed to update token. Please try again.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteToken = async (tokenId: string) => {
    if (!confirm("Are you sure you want to delete this token?")) {
      return;
    }

    try {
      await del<any>(`${ENDPOINTS.TOKENS.BY_ID}/${tokenId}`);
      // Refresh tokens list
      fetchTokens();
    } catch (error) {
      console.error("Failed to delete token:", error);
      alert("Failed to delete token. Please try again.");
    }
  };

  const fetchTokens = async () => {
    try {
      const data = await getRaw<{ data: any[] }>(ENDPOINTS.TOKENS.GET_ALL);
      setTokens(data.data || []);
    } catch (error) {
      console.error("Failed to fetch tokens:", error);
    } finally {
      setTokensLoading(false);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [activeData, expiredData, vebaActiveData, vebaExpiredData] = await Promise.all([
          getRaw<{ data: { count: number } }>(ENDPOINTS.STATISTICS.TOKENS_ACTIVE),
          getRaw<{ data: { count: number } }>(ENDPOINTS.STATISTICS.TOKENS_EXPIRED),
          getRaw<{ data: { count: number } }>(ENDPOINTS.STATISTICS.VEBA_TOKENS_ACTIVE),
          getRaw<{ data: { count: number } }>(ENDPOINTS.STATISTICS.VEBA_TOKENS_EXPIRED),
        ]);

        const runningTokens = activeData.data.count;
        const expiredTokens = expiredData.data.count;
        const activeVebaTokens = vebaActiveData.data.count;
        const expiredVebaTokens = vebaExpiredData.data.count;
        const totalActiveTokens = runningTokens + activeVebaTokens;

        setStats({
          runningTokens,
          expiredTokens,
          activeVebaTokens,
          expiredVebaTokens,
          totalActiveTokens,
        });
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
    fetchTokens();
  }, []);

  // ── Filtered + sorted tokens for the Explorer-style listing ───────────────
  const visibleTokens = useMemo(() => {
    const q = tokenSearch.trim().toLowerCase();
    let list = tokens;
    if (q) {
      list = list.filter((t) =>
        (t.token_name || "").toLowerCase().includes(q) ||
        (t.token_type || "").toLowerCase().includes(q) ||
        (t.product?.product_name || "").toLowerCase().includes(q) ||
        (t.token_currency || "").toLowerCase().includes(q) ||
        (t.billing_unit || "").toLowerCase().includes(q)
      );
    }
    const { key, dir } = tokenSort;
    const factor = dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      let av: any, bv: any;
      if (key === "amount") { av = Number(a.token_amount) || 0; bv = Number(b.token_amount) || 0; }
      else if (key === "product") { av = (a.product?.product_name || "").toLowerCase(); bv = (b.product?.product_name || "").toLowerCase(); }
      else { av = (a[key] ?? "").toString().toLowerCase(); bv = (b[key] ?? "").toString().toLowerCase(); }
      if (av < bv) return -1 * factor;
      if (av > bv) return 1 * factor;
      return 0;
    });
  }, [tokens, tokenSearch, tokenSort]);

  const toggleSort = (key: string) =>
    setTokenSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  const sortArrow = (key: string) => (tokenSort.key === key ? (tokenSort.dir === "asc" ? "▲" : "▼") : "");

  const fmtAmount = (t: any) =>
    t.token_amount != null && t.token_amount !== ""
      ? `${(t.token_currency || "").toUpperCase()} ${Number(t.token_amount).toLocaleString()}`
      : "—";
  const fmtDate = (t: any) => (t.date_created ? String(t.date_created).split(" ")[0] : "—");

  // Inline row/tile actions (stops propagation so clicks don't toggle selection)
  const renderTokenActions = (token: any) => (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => handleViewToken(token.token_id)}
        title="Details"
        className="w-7 h-7 grid place-items-center rounded-md bg-[#34B7F1]/10 text-[#1E88B5] text-[12px] hover:bg-[#34B7F1]/20 transition-colors border-none cursor-pointer"
      >⊙</button>
      <PermissionGate permission="tokens.update">
        <button
          onClick={() => handleEditToken(token.token_id)}
          title="Edit"
          className="w-7 h-7 grid place-items-center rounded-md bg-[#F97316]/10 text-[#C2570B] text-[12px] hover:bg-[#F97316]/20 transition-colors border-none cursor-pointer"
        >✎</button>
      </PermissionGate>
      <PermissionGate permission="tokens.delete">
        <button
          onClick={() => handleDeleteToken(token.token_id)}
          title="Delete"
          className="w-7 h-7 grid place-items-center rounded-md bg-[#EF4444]/10 text-[#DC2626] text-[12px] hover:bg-[#EF4444]/20 transition-colors border-none cursor-pointer"
        >🗑</button>
      </PermissionGate>
    </div>
  );

  // Renders a single token for the non-Details views (icons / list / tiles / content)
  const renderTokenItem = (token: any, i: number) => {
    const meta = tokenMeta(token.token_type);
    const isSel = selectedTokenId === token.token_id;
    const sz = TOKEN_ICON_SIZE[tokenView];
    const iconEl = (
      <div className={`${sz.box} rounded-xl ${meta.tint} ${meta.text} grid place-items-center ${sz.text} shrink-0`}>{meta.icon}</div>
    );
    const rowSel = isSel ? "bg-[#128C7E]/10 ring-1 ring-inset ring-[#128C7E]/30" : "hover:bg-[#F8FAFC]";
    const cardSel = isSel ? "border-[#128C7E] bg-[#128C7E]/5 ring-1 ring-[#128C7E]/30" : "border-[#E9EDEF] bg-white hover:border-[#128C7E]/40 hover:shadow-sm";
    const actionFade = `transition-opacity ${isSel ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`;
    const common = {
      key: token.token_id || i,
      onClick: () => setSelectedTokenId(token.token_id),
      onDoubleClick: () => handleViewToken(token.token_id),
    };

    // Icon views — centered tile
    if (tokenView === "xl" || tokenView === "large" || tokenView === "medium") {
      return (
        <div {...common} className={`group relative rounded-xl p-3 flex flex-col items-center text-center gap-2 cursor-default transition-colors ${rowSel}`}>
          <div className={`absolute top-1.5 right-1.5 ${actionFade}`}>{renderTokenActions(token)}</div>
          {iconEl}
          <div className="min-w-0 w-full">
            <div className="text-[12px] font-black text-[#111B21] truncate">{token.token_name}</div>
            <div className="text-[10px] text-[#667781] truncate">{fmtAmount(token)}</div>
            {tokenView !== "medium" && (
              <div className="text-[9px] text-[#9AA5AD] truncate capitalize">{token.token_type || ""}</div>
            )}
          </div>
        </div>
      );
    }

    // Small icons / List — compact horizontal item
    if (tokenView === "small" || tokenView === "list") {
      return (
        <div {...common} className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-default transition-colors ${rowSel}`}>
          {iconEl}
          <div className="text-[12px] font-bold text-[#111B21] truncate flex-1 min-w-0">{token.token_name}</div>
          <div className={`shrink-0 ${actionFade}`}>{renderTokenActions(token)}</div>
        </div>
      );
    }

    // Tiles — icon + meta + price card
    if (tokenView === "tiles") {
      return (
        <div {...common} className={`group flex items-start gap-3 rounded-xl border p-3 cursor-default transition-all ${cardSel}`}>
          {iconEl}
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-black text-[#111B21] truncate">{token.token_name}</div>
            <div className="text-[10px] text-[#667781] truncate capitalize">
              {token.token_type || "—"}{token.product?.product_name ? ` · ${String(token.product.product_name).toUpperCase()}` : ""}
            </div>
            <div className="text-[12px] font-black text-[#128C7E] mt-1 truncate">{fmtAmount(token)}</div>
          </div>
          <div className={`shrink-0 ${actionFade}`}>{renderTokenActions(token)}</div>
        </div>
      );
    }

    // Content — full-width detailed row
    return (
      <div {...common} className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-default transition-colors ${rowSel}`}>
        {iconEl}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[12px] font-black text-[#111B21] truncate">{token.token_name}</span>
            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black ${meta.tint} ${meta.text} capitalize shrink-0`}>{token.token_type || "—"}</span>
          </div>
          <div className="text-[10px] text-[#667781] truncate mt-0.5">
            {token.product?.product_name ? `Product ${String(token.product.product_name).toUpperCase()}` : "No product"}
            {token.billing_unit ? ` · per ${token.billing_unit}` : ""}
            {token.billing_scope ? ` · ${token.billing_scope}` : ""}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[12px] font-black text-[#111B21]">{fmtAmount(token)}</div>
          <div className="text-[10px] text-[#9AA5AD]">{fmtDate(token)}</div>
        </div>
        <div className={`shrink-0 ${actionFade}`}>{renderTokenActions(token)}</div>
      </div>
    );
  };

  return (
    <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col gap-3 p-3">

        
        

          {/* ── 5 Mini KPI bars ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-5 gap-3">
            {statsLoading ? (
              <>
                <div className="bg-white border border-[#E9EDEF] rounded-xl p-3 animate-pulse">
                  <div className="h-3 bg-[#E9EDEF] rounded w-16 mb-2"></div>
                  <div className="h-7 bg-[#E9EDEF] rounded w-24 mt-2"></div>
                </div>
                <div className="bg-white border border-[#E9EDEF] rounded-xl p-3 animate-pulse">
                  <div className="h-3 bg-[#E9EDEF] rounded w-16 mb-2"></div>
                  <div className="h-7 bg-[#E9EDEF] rounded w-24 mt-2"></div>
                </div>
                <div className="bg-white border border-[#E9EDEF] rounded-xl p-3 animate-pulse">
                  <div className="h-3 bg-[#E9EDEF] rounded w-16 mb-2"></div>
                  <div className="h-7 bg-[#E9EDEF] rounded w-24 mt-2"></div>
                </div>
                <div className="bg-white border border-[#E9EDEF] rounded-xl p-3 animate-pulse">
                  <div className="h-3 bg-[#E9EDEF] rounded w-16 mb-2"></div>
                  <div className="h-7 bg-[#E9EDEF] rounded w-24 mt-2"></div>
                </div>
                <div className="bg-white border border-[#E9EDEF] rounded-xl p-3 animate-pulse">
                  <div className="h-3 bg-[#E9EDEF] rounded w-16 mb-2"></div>
                  <div className="h-7 bg-[#E9EDEF] rounded w-24 mt-2"></div>
                </div>
              </>
            ) : (
              [
                { label: "Running Tokens", value: stats.runningTokens.toString(), pct: Math.min(stats.runningTokens / 100 * 100, 100), tone: "bg-[#128C7E]" },
                { label: "Expired Tokens", value: stats.expiredTokens.toString(), pct: Math.min(stats.expiredTokens / 100 * 100, 100), tone: "bg-[#F97316]" },
                { label: "Active VEBA Tokens", value: stats.activeVebaTokens.toString(), pct: Math.min(stats.activeVebaTokens / 100 * 100, 100), tone: "bg-[#F97316]" },
                { label: "Expired VEBA Tokens", value: stats.expiredVebaTokens.toString(), pct: Math.min(stats.expiredVebaTokens / 100 * 100, 100), tone: "bg-[#25D366]" },
                { label: "Total Active Tokens", value: stats.totalActiveTokens.toString(), pct: Math.min(stats.totalActiveTokens / 100 * 100, 100), tone: "bg-[#34B7F1]" },
              ].map(b => (
                <div key={b.label} className="bg-white border border-[#E9EDEF] rounded-xl p-3">
                  <div className="font-black text-[12px] text-[#111B21]">{b.label}</div>
                  <div className="font-black text-[22px] text-[#111B21] leading-tight mt-0.5">{b.value}</div>
                  <div className="h-2 rounded-full bg-[#E9EDEF] mt-2 overflow-hidden">
                    <div className={`h-full rounded-full ${b.tone}`} style={{ width: `${b.pct}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Tokens (Explorer-style) ───────────────────────────────────────── */}
          <div className="bg-white border border-[#E9EDEF] rounded-xl overflow-hidden flex flex-col min-h-0">

            {/* Command bar */}
            <div className="px-3 py-2.5 border-b border-[#E9EDEF] flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0 mr-auto">
                <span className="font-black text-[13px] text-[#111B21]">Tokens</span>
                <span className="text-[11px] text-[#667781] bg-[#F0F2F5] rounded-full px-2 py-0.5 font-black">{visibleTokens.length}</span>
              </div>

              {/* Search */}
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9AA5AD] text-[12px] pointer-events-none">⌕</span>
                <input
                  value={tokenSearch}
                  onChange={(e) => setTokenSearch(e.target.value)}
                  placeholder="Search tokens…"
                  className="h-8 w-[200px] max-w-[42vw] pl-7 pr-3 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[12px] text-[#111B21] outline-none focus:border-[#128C7E] focus:bg-white transition-all"
                />
              </div>

              {/* View menu (Explorer-style) */}
              <div className="relative">
                <button
                  onClick={() => setViewMenuOpen((o) => !o)}
                  title="Change view"
                  className={`h-8 px-3 rounded-lg border text-[12px] font-black cursor-pointer flex items-center gap-1.5 transition-all ${viewMenuOpen ? "bg-[#128C7E] text-white border-[#128C7E]" : "bg-[#F0F2F5] border-[#E9EDEF] text-[#667781] hover:bg-[#E9EDEF]"}`}
                >
                  <span className="text-[13px] leading-none">{TOKEN_VIEW_OPTIONS.find((o) => o.key === tokenView)?.glyph}</span>
                  View
                  <span className="text-[8px]">▾</span>
                </button>
                {viewMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-[40]" onClick={() => setViewMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-white rounded-xl shadow-xl border border-[#E9EDEF] py-1">
                      {TOKEN_VIEW_OPTIONS.map((o) => (
                        <button
                          key={o.key}
                          onClick={() => { setTokenView(o.key); setViewMenuOpen(false); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left hover:bg-[#F0F2F5] cursor-pointer border-none bg-transparent"
                        >
                          <span className="w-3 text-[#128C7E] text-[10px]">{tokenView === o.key ? "●" : ""}</span>
                          <span className="w-4 text-[14px] text-[#667781] text-center">{o.glyph}</span>
                          <span className={tokenView === o.key ? "font-black text-[#111B21]" : "text-[#111B21]"}>{o.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <PermissionGate permission="tokens.create">
                <button
                  onClick={() => setCreateBladeOpen(true)}
                  className="h-8 px-3 rounded-lg bg-[#25D366] text-[#075E54] text-[12px] font-black border-none cursor-pointer hover:brightness-105 flex items-center gap-1"
                >
                  <span className="text-[15px] leading-none">+</span> New Token
                </button>
              </PermissionGate>
            </div>

            {/* Body */}
            <div className="p-2">
              {tokensLoading ? (
                tokenView !== "details" ? (
                  <div className={`grid gap-2 ${TOKEN_VIEW_GRID[tokenView] || ""}`}>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="rounded-xl border border-[#E9EDEF] p-3 animate-pulse">
                        <div className="w-10 h-10 rounded-xl bg-[#E9EDEF] mb-3" />
                        <div className="h-3 bg-[#E9EDEF] rounded w-2/3 mb-2" />
                        <div className="h-2.5 bg-[#E9EDEF] rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
                        <div className="w-8 h-8 rounded-lg bg-[#E9EDEF] shrink-0" />
                        <div className="h-3 bg-[#E9EDEF] rounded w-1/4" />
                        <div className="h-3 bg-[#E9EDEF] rounded w-16 ml-auto" />
                      </div>
                    ))}
                  </div>
                )
              ) : visibleTokens.length === 0 ? (
                <div className="text-center py-14">
                  <div className="text-[34px] mb-2">{tokenSearch ? "\U0001F50D" : "\U0001F3AB"}</div>
                  <p className="text-[13px] font-black text-[#111B21] mb-1">{tokenSearch ? "No matching tokens" : "No tokens yet"}</p>
                  <p className="text-[12px] text-[#667781]">
                    {tokenSearch ? `Nothing matches "${tokenSearch}".` : "Create your first token to get started."}
                  </p>
                  {tokenSearch && (
                    <button onClick={() => setTokenSearch("")} className="mt-3 h-8 px-3 rounded-lg bg-[#F0F2F5] border border-[#E9EDEF] text-[11px] font-black text-[#667781] cursor-pointer hover:bg-[#E9EDEF]">Clear search</button>
                  )}
                </div>
              ) : tokenView === "details" ? (
                <div>
                  <div className="grid grid-cols-[minmax(0,2.4fr)_0.9fr_1.1fr_1.1fr_0.9fr_auto] items-center gap-2 px-3 py-1.5 border-b border-[#E9EDEF]">
                    {[
                      { key: "token_name", label: "Name" },
                      { key: "token_type", label: "Type" },
                      { key: "product", label: "Product" },
                      { key: "amount", label: "Amount" },
                      { key: "date_created", label: "Created" },
                    ].map((c) => (
                      <button key={c.key} onClick={() => toggleSort(c.key)} className="text-left flex items-center gap-1 text-[10px] font-black text-[#667781] uppercase tracking-wide bg-transparent border-none cursor-pointer hover:text-[#128C7E] transition-colors">
                        {c.label}<span className="text-[8px] text-[#128C7E]">{sortArrow(c.key)}</span>
                      </button>
                    ))}
                    <span className="text-[10px] font-black text-[#667781] uppercase tracking-wide text-right pr-1">Actions</span>
                  </div>
                  <div className="flex flex-col">
                    {visibleTokens.map((token: any, i: number) => {
                      const meta = tokenMeta(token.token_type);
                      const isSel = selectedTokenId === token.token_id;
                      return (
                        <div key={token.token_id || i} onClick={() => setSelectedTokenId(token.token_id)} onDoubleClick={() => handleViewToken(token.token_id)} className={`group grid grid-cols-[minmax(0,2.4fr)_0.9fr_1.1fr_1.1fr_0.9fr_auto] items-center gap-2 px-3 py-2 rounded-lg cursor-default transition-colors ${isSel ? "bg-[#128C7E]/10 ring-1 ring-inset ring-[#128C7E]/30" : "hover:bg-[#F8FAFC]"}`}>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-8 h-8 rounded-lg ${meta.tint} ${meta.text} grid place-items-center text-[15px] shrink-0`}>{meta.icon}</div>
                            <div className="min-w-0">
                              <div className="text-[12px] font-black text-[#111B21] truncate">{token.token_name}</div>
                              <div className="text-[9px] text-[#9AA5AD] font-mono truncate">{token.token_id ? `${String(token.token_id).slice(0, 8)}...` : ""}</div>
                            </div>
                          </div>
                          <div className="min-w-0">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black ${meta.tint} ${meta.text} capitalize truncate max-w-full`}>{token.token_type || "-"}</span>
                          </div>
                          <div className="text-[11px] text-[#667781] uppercase tracking-wide truncate">{token.product?.product_name ? String(token.product.product_name).toUpperCase() : "-"}</div>
                          <div className="min-w-0">
                            <div className="text-[12px] font-black text-[#111B21] truncate">{fmtAmount(token)}</div>
                            {token.billing_unit && <div className="text-[9px] text-[#9AA5AD] truncate">per {token.billing_unit}</div>}
                          </div>
                          <div className="text-[11px] text-[#667781] truncate">{fmtDate(token)}</div>
                          <div className={`justify-self-end transition-opacity ${isSel ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                            {renderTokenActions(token)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className={`grid gap-2 ${TOKEN_VIEW_GRID[tokenView] || ""}`}>
                  {visibleTokens.map((token: any, i: number) => renderTokenItem(token, i))}
                </div>
              )}
            </div>

            <div className="px-4 py-2 text-[10px] text-[#9AA5AD] border-t border-[#E9EDEF] flex items-center justify-between">
              <span>Double-click a token to open its details.</span>
              <span>{visibleTokens.length} item{visibleTokens.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>
      </main>

      {/* ── Create Token Blade ─────────────────────────────────────────────── */}
      {createBladeOpen && (
        <div className="fixed inset-0 z-[9000] bg-[#111B21]/30 flex justify-end" onClick={() => setCreateBladeOpen(false)}>
          <div className="bg-white w-full max-w-[500px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300" onClick={e => e.stopPropagation()}>

            {/* Blade header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#075E54] shrink-0">
              <span className="font-black text-[15px] text-white">New Token</span>
              <button onClick={() => setCreateBladeOpen(false)} className="w-8 h-8 rounded-lg bg-white/10 border border-white/25 text-white font-black text-[14px] cursor-pointer grid place-items-center">✕</button>
            </div>

            {/* Blade body */}
            <div className="flex-1 overflow-y-auto bg-[#F0F2F5] p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-black text-[#667781] mb-1">Name</label>
                  <input
                    type="text"
                    value={createForm.token_name}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, token_name: e.target.value }))}
                    placeholder="Enter Name"
                    className="w-full h-9 rounded-lg border border-[#E9EDEF] bg-white px-3 text-[13px] outline-none focus:border-[#128C7E]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-black text-[#667781] mb-1">Type</label>
                  <select
                    value={createForm.token_type}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, token_type: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-[#E9EDEF] bg-white px-3 text-[13px] outline-none focus:border-[#128C7E]"
                  >
                    <option value="">Select Type</option>
                    <option value="dynamic">Dynamic</option>
                    <option value="parameter">Parameter</option>
                    <option value="veba">VEBA Token</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-black text-[#667781] mb-1">Amount</label>
                    <input
                      type="text"
                      value={createForm.token_amount}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, token_amount: e.target.value }))}
                      placeholder="Enter Amount"
                      className="w-full h-9 rounded-lg border border-[#E9EDEF] bg-white px-3 text-[13px] outline-none focus:border-[#128C7E]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-black text-[#667781] mb-1">Currency</label>
                    <select
                      value={createForm.token_currency}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, token_currency: e.target.value }))}
                      className="w-full h-9 rounded-lg border border-[#E9EDEF] bg-white px-3 text-[13px] outline-none focus:border-[#128C7E]"
                    >
                      <option value="">Select Currency</option>
                      <option value="ugx">UGX</option>
                      <option value="kes">KES</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-black text-[#667781] mb-1">Validity (Hours)</label>
                  <input
                    type="text"
                    value={createForm.token_validity}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, token_validity: e.target.value }))}
                    placeholder="Enter Validity"
                    className="w-full h-9 rounded-lg border border-[#E9EDEF] bg-white px-3 text-[13px] outline-none focus:border-[#128C7E]"
                  />
                </div>
                {createForm.token_type === "parameter" && (
                  <div>
                    <label className="block text-[12px] font-black text-[#667781] mb-1">Parameters</label>
                    <select
                      multiple
                      value={createForm.parameters || []}
                      onChange={(e) => {
                        const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                        setCreateForm(prev => ({ ...prev, parameters: selectedOptions }));
                      }}
                      className="w-full h-40 rounded-lg border border-[#E9EDEF] bg-white px-3 text-[13px] outline-none focus:border-[#128C7E] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                      <optgroup label="Xirgo Parameters">
                        {XIRGO_PARAMS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Teltonika Parameters">
                        {TELTONIKA_PARAMS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Other IOT Parameters">
                        {OTHER_IOT_PARAMS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </optgroup>
                    </select>
                    <div className="text-[11px] text-[#667781] mt-1">
                      Hold Ctrl/Cmd to select multiple
                    </div>
                  </div>
                )}
              </div>



              {/* C) Parameter Mapping */}
              {false && (<ModalSection title="C) Parameter Mapping (Origin + RPS sorting)">
                {createForm.token_type === "parameter" ? (
                  <div className="p-4">
                    <label className="block text-[12px] font-black text-[#667781] mb-2">Select Parameters</label>
                    <select
                      multiple
                      value={createForm.parameters || []}
                      onChange={(e) => {
                        const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                        setCreateForm(prev => ({ ...prev, parameters: selectedOptions }));
                      }}
                      className="w-full h-32 rounded-lg border border-[#E9EDEF] bg-white px-3 text-[13px] text-[#111B21] outline-none focus:border-[#128C7E] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                      <optgroup label="Xirgo Parameters">
                        {XIRGO_PARAMS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Teltonika Parameters">
                        {TELTONIKA_PARAMS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Other IOT Parameters">
                        {OTHER_IOT_PARAMS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </optgroup>
                    </select>
                    <div className="text-[11px] text-[#667781] mt-2">
                      Hold Ctrl/Cmd to select multiple parameters
                    </div>
                  </div>
                ) : (
                  <table className="w-full text-[12px]">
                    <thead><tr className="bg-[#F8FAFC] border-b border-[#E9EDEF]">
                      {["Param","Origin","RPS","Bill","State"].map(h => (
                        <th key={h} className="text-left px-4 py-2 font-black text-[#667781]">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {MODAL_PARAMS.map(p => (
                        <tr key={p.param} className="border-b border-[#E9EDEF] last:border-0">
                          <td className="px-4 py-2 text-[#111B21]">{p.param}</td>
                          <td className="px-4 py-2 text-[#667781]">{p.origin}</td>
                          <td className="px-4 py-2 text-[#111B21]">{p.rps}</td>
                          <td className="px-4 py-2 text-[#667781]">{p.bill}</td>
                          <td className={`px-4 py-2 font-black ${p.state==="HIC"?"text-[#EF4444]":p.state==="HITL"?"text-[#F97316]":""}`}>{p.state}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </ModalSection>)}

            </div>

            {/* Blade footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[#E9EDEF] bg-white shrink-0">
              <button onClick={() => setCreateBladeOpen(false)} className="h-9 px-5 rounded-lg bg-white border border-[#E9EDEF] text-[12px] font-black text-[#111B21] cursor-pointer hover:bg-[#F8FAFC]">Cancel</button>
              <button
                onClick={handleCreateToken}
                disabled={createLoading}
                className="h-9 px-5 rounded-lg bg-[#128C7E] border-none text-white text-[12px] font-black cursor-pointer hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createLoading ? "Creating..." : "Create Token"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Token Details/Edit Side Blade ───────────────────────────────────── */}
      {sideBladeOpen && (
        <div className="fixed inset-0 z-[8000] bg-[#111B21]/30 flex justify-end" onClick={() => setSideBladeOpen(false)}>
          <div className="bg-white w-full max-w-[500px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300" onClick={e => e.stopPropagation()}>

            {/* Side blade header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#075E54] shrink-0">
              <span className="font-black text-[15px] text-white">
                {editMode ? 'Edit Token' : 'Token Details'}
              </span>
              <div className="flex items-center gap-3">
                {editMode && (
                  <button
                    onClick={() => setEditMode(false)}
                    className="px-3 py-1 text-[11px] font-black bg-white/20 text-white rounded hover:bg-white/30 transition-colors"
                  >
                    Cancel Edit
                  </button>
                )}
                <button onClick={() => setSideBladeOpen(false)} className="w-8 h-8 rounded-lg bg-white/10 border border-white/25 text-white font-black text-[14px] cursor-pointer grid place-items-center">✕</button>
              </div>
            </div>

            {/* Side blade body */}
            <div className="flex-1 overflow-y-auto bg-[#F0F2F5] p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {editMode ? (
                /* Edit Mode */
                <div className="space-y-4">
                  <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
                    <h3 className="font-black text-[14px] text-[#111B21] mb-4">Token Information</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[12px] font-black text-[#667781] mb-1">Token Name</label>
                        <input
                          type="text"
                          value={editForm.token_name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, token_name: e.target.value }))}
                          className="w-full h-9 rounded-lg border border-[#E9EDEF] bg-white px-3 text-[13px] text-[#111B21] outline-none focus:border-[#128C7E]"
                        />
                      </div>
                      <div>
                        <label className="block text-[12px] font-black text-[#667781] mb-1">Token Type</label>
                        <select
                          value={editForm.token_type}
                          onChange={(e) => setEditForm(prev => ({ ...prev, token_type: e.target.value }))}
                          className="w-full h-9 rounded-lg border border-[#E9EDEF] bg-white px-3 text-[13px] text-[#111B21] outline-none focus:border-[#128C7E]"
                        >
                          <option value="">Select Type</option>
                          <option value="dynamic">Dynamic</option>
                          <option value="parameter">Parameter</option>
                          <option value="veba">VEBA Token</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[12px] font-black text-[#667781] mb-1">Amount</label>
                          <input
                            type="number"
                            value={editForm.token_amount}
                            onChange={(e) => setEditForm(prev => ({ ...prev, token_amount: e.target.value }))}
                            className="w-full h-9 rounded-lg border border-[#E9EDEF] bg-white px-3 text-[13px] text-[#111B21] outline-none focus:border-[#128C7E]"
                          />
                        </div>
                        <div>
                          <label className="block text-[12px] font-black text-[#667781] mb-1">Currency</label>
                          <select
                            value={editForm.token_currency}
                            onChange={(e) => setEditForm(prev => ({ ...prev, token_currency: e.target.value }))}
                            className="w-full h-9 rounded-lg border border-[#E9EDEF] bg-white px-3 text-[13px] text-[#111B21] outline-none focus:border-[#128C7E]"
                          >
                            <option value="ugx">UGX</option>
                            <option value="kes">KES</option>
                            <option value="usd">USD</option>
                            <option value="tzs">TZS</option>
                            <option value="rwf">RWF</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[12px] font-black text-[#667781] mb-1">Validity (Hours)</label>
                        <input
                          type="number"
                          value={editForm.token_validity}
                          onChange={(e) => setEditForm(prev => ({ ...prev, token_validity: e.target.value }))}
                          className="w-full h-9 rounded-lg border border-[#E9EDEF] bg-white px-3 text-[13px] text-[#111B21] outline-none focus:border-[#128C7E]"
                        />
                      </div>
                      {editForm.token_type === "parameter" && (
                        <div>
                          <label className="block text-[12px] font-black text-[#667781] mb-1">Parameters</label>
                          <select
                            multiple
                            value={editForm.parameters || []}
                            onChange={(e) => {
                              const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                              setEditForm(prev => ({ ...prev, parameters: selectedOptions }));
                            }}
                            className="w-full h-32 rounded-lg border border-[#E9EDEF] bg-white px-3 text-[13px] text-[#111B21] outline-none focus:border-[#128C7E] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                          >
                            <optgroup label="Xirgo Parameters">
                              {XIRGO_PARAMS.map(p => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Teltonika Parameters">
                              {TELTONIKA_PARAMS.map(p => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Other IOT Parameters">
                              {OTHER_IOT_PARAMS.map(p => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                              ))}
                            </optgroup>
                          </select>
                          <div className="text-[11px] text-[#667781] mt-2">
                            Hold Ctrl/Cmd to select multiple parameters
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div className="space-y-4">
                  <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
                    <h3 className="font-black text-[14px] text-[#111B21] mb-4">Token Information</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-[#E9EDEF] last:border-0">
                        <span className="text-[12px] font-black text-[#667781]">Token ID</span>
                        <span className="text-[13px] text-[#111B21] font-mono">{selectedToken?.token_id}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-[#E9EDEF] last:border-0">
                        <span className="text-[12px] font-black text-[#667781]">Token Name</span>
                        <span className="text-[13px] text-[#111B21] font-bold">{selectedToken?.token_name}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-[#E9EDEF] last:border-0">
                        <span className="text-[12px] font-black text-[#667781]">Token Type</span>
                        <span className="text-[13px] text-[#111B21]">{selectedToken?.token_type}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-[#E9EDEF] last:border-0">
                        <span className="text-[12px] font-black text-[#667781]">Amount</span>
                        <span className="text-[13px] text-[#111B21] font-bold">{selectedToken?.token_currency?.toUpperCase()} {selectedToken?.token_amount}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-[#E9EDEF] last:border-0">
                        <span className="text-[12px] font-black text-[#667781]">Validity</span>
                        <span className="text-[13px] text-[#111B21]">{selectedToken?.token_validity} Hours</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-[#E9EDEF] last:border-0">
                        <span className="text-[12px] font-black text-[#667781]">Status</span>
                        <span className={`px-2 py-1 rounded-full text-[10px] font-black ${
                          selectedToken?.token_type === 'active' ? 'bg-[#25D366] text-white' :
                          selectedToken?.token_type === 'expired' ? 'bg-[#EF4444] text-white' :
                          'bg-[#F97316] text-white'
                        }`}>
                          {selectedToken?.token_type || 'active'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedToken?.token_parameters && selectedToken.token_parameters.length > 0 && (
                    <div className="bg-white border border-[#E9EDEF] rounded-xl p-4">
                      <h3 className="font-black text-[14px] text-[#111B21] mb-4">Parameters</h3>
                      <div className="space-y-2">
                        {selectedToken.token_parameters.map((param: string, index: number) => (
                          <div key={index} className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#25D366] shrink-0"></span>
                            <span className="text-[12px] text-[#111B21]">{param}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Side blade footer */}
            {editMode && (
              <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[#E9EDEF] bg-white shrink-0">
                <button
                  onClick={() => setSideBladeOpen(false)}
                  className="h-9 px-5 rounded-lg bg-white border border-[#E9EDEF] text-[12px] font-black text-[#111B21] cursor-pointer hover:bg-[#F8FAFC]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateToken}
                  disabled={editLoading}
                  className="h-9 px-5 rounded-lg bg-[#128C7E] border-none text-white text-[12px] font-black cursor-pointer hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editLoading ? "Updating..." : "Update Token"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Reusable components ─────────────────────────────────────────────────────
const pillStyles: Record<string, string> = {
  green: "bg-[#25D366] text-[#075E54]",
  azure: "bg-[#34B7F1] text-white",
  teal:  "bg-[#128C7E] text-white",
  ghost: "bg-white border border-[#E9EDEF] text-[#667781]",
};

function Pill({ color = "ghost", onClick, children }: { color?: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-7 px-3 rounded-full text-[11px] font-black border-none cursor-pointer hover:brightness-105 active:opacity-85 transition-all whitespace-nowrap ${pillStyles[color] ?? pillStyles.ghost}`}
    >
      {children}
    </button>
  );
}

function ModalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 border border-[#E9EDEF] rounded-xl overflow-hidden bg-white">
      <div className="bg-[#E9EDEF] px-4 py-2.5 font-black text-[13px] text-[#111B21]">{title}</div>
      {children}
    </div>
  );
}