Se requiere un programa en fastapi que genere datos de maduradores , EN ESTE CASO identificador 1010 reciba una lista de maduradores pertenecientes a esa empresa con identificador 1010 .


que al ir a la ruta  IP:9090//Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=1010


ejemplo de lista de dispositivos , con dato de madurador <ESTRUCTURA_ULTIMOS_DATOS>
[
  {
    "imei": "ZGRUMAD00000001",# aqui el identificador del programa no necesariamete tiene que ser un imei de 15 digitos tiene que ser unico 
    "estado": 1, #1 es activo , 0 archivado 
    "sp_etileno" : 120 ,
    "historial_sp_etileno":[
        {
            "valor": 100,
            "desde": "2026-03-08T10:38:41.845000",
            "hasta": "2026-03-10T11:28:41.845000"
        },
        {
            "valor": 130,
            "desde": "2026-03-12T10:38:41.845000",
            "hasta": "2026-03-15T11:28:41.845000"
        }

    ],

    "fecha_procesada": "2026-04-11T11:00:07.866000", # fecha de la ultima normalizacion de datos
    "fecha_inicio": "2026-04-01T16:31:55.552000", #fecha desde que inicio a llegar los datos de telemetria
    "proceso" : "Manual" , # pude ser automatico , homogenizacion , ventilacion maduracion 
    "id_proceso" :1000001 ,
    "ultimo_dato": {
      "temp_supply_1": 21.9, validacion de [-45 a 50 ] .#Logica si esta alrededor de set_point (+- 5) equipo funcionando estable
      "temp_supply_2": "E01",validacion de [-45 a 50 ]
      "return_air": 26.3, # validacion de [-45 a 50 ]Logica si esta alrededor de  set_point(+-5) el frio esta circulando correctamente y la carga interna del contenedor esta en rango
      "evaporation_coil": 19.1,validacion de [-45 a 50 ] #nromalamnte caundo esta en positivo y return_air y temp_supply_1 estan en negativo es que se activo la resistencia y esta en un proceso de defrost
      "condensation_coil": 38.8,validacion de [-45 a 50 ]
      "compress_coil_1": 63.7, validacion de [-45 a 130 ]# temeparatura d compresor por debajo de 90° esta normal , en un rango de 90 a 100 esta es "esfuerzo" , de 100 a 110 esta sobre-esfuerzo . y mas de 110 es critico
      "compress_coil_2": "E00",validacion de [-45 a 130 ]
      "ambient_air": 693.9, # validacion de [-20 a 60 ]
      "cargo_1_temp": -51.1,# validacion de [-25 a 50 ]
      "cargo_2_temp": -38.5,# validacion de [-25 a 50 ]
      "cargo_3_temp": -38.5,# validacion de [-25 a 50 ]
      "cargo_4_temp": -38.5,# validacion de [-25 a 50 ]
      "relative_humidity": 19839,# validacion de [1 a 99 ]
      "avl": 0,# validacion de [0,225 ]
      "suction_pressure": -5.12,# validacion de [0,225 ]
      "discharge_pressure": -3.85,# validacion de [0,225 ]
      "line_voltage": -12161,# validacion de [0,500 ]
      "line_frequency": 15361,# validacion de [0,80 ]
      "consumption_ph_1": # validacion de [0,20 ]
      "consumption_ph_2": # validacion de [0,20 ]
      "consumption_ph_3": # validacion de [0,20 ]
      "co2_reading": -51.2,# validacion de [0,25 ]
      "o2_reading": -64.1,# validacion de [0,25 ]
      "evaporator_speed": 15487,# validacion de [0,200 ]
      "condenser_speed": 13824,# validacion de [0,200 ]
      "battery_voltage": 3020.8,# validacion de [0,100 ]
      "power_kwh": 3491.9, # validacion solo mayores a 0 
      "power_trip_reading": 3353.6, # validacion solo mayores a 0 
      "power_trip_duration": 133041152, # validacion solo mayores a 0 
      "suction_temp": -51.2,validacion de [-45 a 130 ]
      "discharge_temp": -38.5, validacion de [-45 a 130 ]
      "supply_air_temp": -908.9,validacion de [-45 a 130 ]
      "return_air_temp": 179.2,validacion de [-45 a 130 ]
      "dl_battery_temp": -5.11,validacion de [-45 a 130 ]
      "dl_battery_charge": 1.27,validacion de [0 a 100 ]
      "power_consumption": -28.16, # validacion solo mayores a 0 
      "power_consumption_avg": 276.5, ## validacion solo mayores a 0 
      "suction_pressure_2": -5.12,# validacion de [0,225 ]
      "suction_temp_2": -12.9,# validacion de [0,225 ]
      "alarm_present": 1, de 0 a 20
      "set_point": 22, validacion de [-45 a 50 ]
      "capacity_load": 28,validacion de [0 a 100 ]
      "power_state": 1,es 0 "apagado y 1 encendido
      "controlling_mode": 0, del 0 al 9 modos de funcionamiento
      "humidity_control": 1, 0 apagado , 1 activo 
      "humidity_set_point": 95,validacion de [0 a 100 ]
      "fresh_air_ex_mode": 0, 0 apagado , 1 manual , 2 automatico
      "fresh_air_ex_rate": "E01",# validacion de [0,225 ]
      "fresh_air_ex_delay": "E01",# validacion de [0,225 ]
      "set_point_o2": "E01",# validacion de [0,25 ]
      "set_point_co2": "E01",# validacion de [0,25 ]
      "defrost_term_temp": 18,# validacion de [0,24 ]
      "defrost_interval": 6,# validacion de [0,24 ]
      "water_cooled_conde": 0,# validacion de [0,100 ]
      "usda_trip": 0,# validacion de [0,100 ]
      "evaporator_exp_valve": "E98",# validacion de [0,100 ]
      "suction_mod_valve": "E98", # validacion de [0,100 ]
      "hot_gas_valve": "E98",# validacion de [0,100 ]
      "economizer_valve": "E98",# validacion de [0,100 ]
      "campo_1": 85.1, # validacion de [0,280 ] , es el nivel de lectura del etileno en ppm 
      "campo_2": 1,# validacion de [0,280 ]
      "campo_3": 1,# validacion de [0,280 ]
      "campo_4": 32516,# validacion de [0,280 ]
      "campo_5": 1051,# validacion de [0,280 ]
      "campo_6": 0,# validacion de [0,280 ]
      "campo_7": 0,# validacion de [0,280 ]
      "campo_8": 0,# validacion de [0,280 ]
      "numero_alarma": 0,# validacion de [0,20 ]
      "alarma_01": -1,# validacion de [0,300 ]
      "alarma_02": -1,# validacion de [0,300 ]
      "alarma_03": -1,# validacion de [0,300 ]
      "alarma_04": -1,# validacion de [0,300 ]
      "alarma_05": -1,# validacion de [0,300 ]
      "alarma_06": -1,# validacion de [0,300 ]
      "alarma_07": -1,# validacion de [0,300 ]
      "alarma_08": -1,# validacion de [0,300 ]
      "alarma_09": -1,# validacion de [0,300 ]
      "alarma_10": -1,# validacion de [0,300 ]
      "imei": "ZGRUMAD00000001", 
      "ip": "10.239.31.146,13,0",
      "device": "UNIT111",
      "fecha": "2026-04-07T14:47:24.120000"
    },
    "hasta": "2026-04-07T14:47:24.120000", # ultima fecha recibida de datos de telemetria
    "ultima_fecha_encendido": "2026-04-02T10:28:41.845000",
    "ultima_fecha_apagado": "2026-04-02T02:28:41.845000",
    "ultimo_power_state": 1, 
    "fresh_air_ex_mode": {
        "modo_actual": 0,
        "fecha_modo_actual": "2026-04-02T10:28:41.845000",
        "ultimo_modo_0":{
                "desde" :"2026-04-02T10:28:41.845000",
                "hasta" : "2026-04-03T10:28:41.845000",
            }, 
        "ultimo_modo_1":{
                "desde" :"2026-03-12T10:28:41.845000",
                "hasta" : "2026-03-13T10:28:41.845000",
            }, 
        "ultimo_modo_2":{
                "desde" :"2026-03-22T10:28:41.845000",
                "hasta" : "2026-03-23T10:28:41.845000",
            } 
    },
    "alarmas": {
      "numero_alarma": 0,
      "activas": []
      "ultima_alarmas"=[
        "alarma_01":{
            "numero" :203,
            "desde" :"2026-04-01T01:28:41.845000",
            "hasta":"2026-04-06T01:29:41.845000"
        },
        "alarma_02":{
            "numero" :114,
            "desde" :"2026-04-01T03:28:41.845000",
            "hasta":"2026-04-06T04:29:41.845000"
        },
      ]
    },
    "compress_coil_1": {
      "estado": "normal",
      "valor_actual": 63.7,
      "fecha_inicio_estado": "2026-04-02T10:28:41.845000",
      "fecha_ultimo_critico": null,
      "fecha_ultimo_normal": "2026-04-02T10:28:41.845000"
    },
    "historico_set_point": [
        {
            "valor": 22.4,
            "desde": "2026-03-04T10:28:41.845000",
            "hasta": "2026-03-06T10:28:41.845000"
        },
        {
            "valor": 17,
            "desde": "2026-03-06T10:38:41.845000",
            "hasta": "2026-03-09T11:28:41.845000"
        }
    ],

    "historial_humidity_set_point":[
        {
            "valor": 90,
            "desde": "2026-03-07T10:38:41.845000",
            "hasta": "2026-03-09T11:28:41.845000"
        },
        {
            "valor": 95,
            "desde": "2026-03-11T10:38:41.845000",
            "hasta": "2026-03-14T11:28:41.845000"
        }

    ],
    "historial_set_point_co2":[
        {
            "valor": 3.5,
            "desde": "2026-03-07T10:38:41.845000",
            "hasta": "2026-03-09T11:28:41.845000"
        },
        {
            "valor": 1.5,
            "desde": "2026-03-11T10:38:41.845000",
            "hasta": "2026-03-14T11:28:41.845000"
        }

    ],
    "historial_power_state":[
        {
            "valor": 1,
            "estado": "encendido"
            "desde": "2026-03-03T10:38:41.845000",
            "hasta": "2026-03-06T11:28:41.845000"
        },
        {
            "valor": 0,
            "estado": "apagado"
            "desde": "2026-03-07T10:38:41.845000",
            "hasta": "2026-03-09T11:28:41.845000"
        },
        {
            "valor": 1,
            "estado": "encendido"
            "desde": "2026-03-11T10:38:41.845000",
            "hasta": "2026-03-14T11:28:41.845000"
        }

    ]
    
    "identificador": "1001"
  }
]

y cuando se ingrese a los detalles de un madurador se busque por imei , le genere una lista de datos del dispositivo por minuto segun se haya conectado la telemtria trasmitiendo  sus datos 

IP/Madurador/buscar_datos_madurador_rango/?imei=ZGRUMAD00000001&fecha_inicio=2026-04-21_14-45-21&fecha_fin=2026-04-24_14-45-21

# ejemplo de conjunto de datos  ESTRUCTURA <MADURADOR_imei>


[{
  "temp_supply_1": 21.6,
  "temp_supply_2": null,
  "return_air": 26.4,
  "evaporation_coil": 18.8,
  "condensation_coil": 39.4,
  "compress_coil_1": 63.5,
  "compress_coil_2": null,
  "ambient_air": 28.4,
  "cargo_1_temp": null,
  "cargo_2_temp": null,
  "cargo_3_temp": null,
  "cargo_4_temp": null,
  "relative_humidity": 75,
  "avl": 0,
  "suction_pressure": null,
  "discharge_pressure": null,
  "line_voltage": 460,
  "line_frequency": 60,
  "consumption_ph_1": 11.5,
  "consumption_ph_2": 12.9,
  "consumption_ph_3": 12.8,
  "co2_reading": null,
  "o2_reading": null,
  "evaporator_speed": 60,
  "condenser_speed": 64,
  "battery_voltage": null,
  "power_kwh": 3486.7,
  "power_trip_reading": 3351,
  "power_trip_duration": 133004800,
  "suction_temp": null,
  "discharge_temp": -38.5,
  "supply_air_temp": null,
  "return_air_temp": null,
  "dl_battery_temp": -5.11,
  "dl_battery_charge": 1.27,
  "power_consumption": null,
  "power_consumption_avg": 276.49,
  "suction_pressure_2": null,
  "suction_temp_2": -12.9,
  "alarm_present": 1,
  "set_point": 22,
  "capacity_load": 31,
  "power_state": 1,
  "controlling_mode": 0,
  "humidity_control": 1,
  "humidity_set_point": 95,
  "fresh_air_ex_mode": 0,
  "fresh_air_ex_rate": null,
  "fresh_air_ex_delay": null,
  "set_point_o2": null,
  "set_point_co2": null,
  "defrost_term_temp": 18,
  "defrost_interval": 6,
  "water_cooled_conde": 0,
  "usda_trip": 0,
  "evaporator_exp_valve": null,
  "suction_mod_valve": null,
  "hot_gas_valve": null,
  "economizer_valve": null,
  "numero_alarma": 0,
  "alarma_01": null,
  "alarma_02": null,
  "alarma_03": null,
  "alarma_04": null,
  "alarma_05": null,
  "alarma_06": null,
  "alarma_07": null,
  "alarma_08": null,
  "alarma_09": null,
  "alarma_10": null,
  "lecturas_erradas": {
    "temp_supply_2": "E01",
    "compress_coil_2": "E00",
    "cargo_1_temp": "E01",
    "cargo_2_temp": "E01",
    "cargo_3_temp": "E01",
    "cargo_4_temp": "E01",
    "suction_pressure": "E01",
    "discharge_pressure": "E01",
    "co2_reading": "E01",
    "o2_reading": "E02",
    "fresh_air_ex_rate": "E01",
    "fresh_air_ex_delay": "E01",
    "set_point_o2": "E01",
    "set_point_co2": "E01",
    "evaporator_exp_valve": "E98",
    "suction_mod_valve": "E98",
    "hot_gas_valve": "E98",
    "economizer_valve": "E98",
    "lecturas_erradas": "E100",
    "ethylene": "E100"
  },
  "ethylene": null,
  "imei": "ZGRUMAD00000001",
  "ip": "10.239.31.146,13,0",
  "campo_1": 85.4,
  "campo_2": 1,
  "campo_3": 1,
  "campo_4": null,
  "campo_5": null,
  "campo_6": 0,
  "campo_7": 0,
  "campo_8": 0,
  "fecha": {
    "$date": "2026-04-24T14:45:21.438Z"
  }
},
{
  "temp_supply_1": 21.9,
  "temp_supply_2": null,
  "return_air": 26.3,
  "evaporation_coil": 19.1,
  "condensation_coil": 38.8,
  "compress_coil_1": 63.7,
  "compress_coil_2": null,
  "ambient_air": null,
  "cargo_1_temp": null,
  "cargo_2_temp": null,
  "cargo_3_temp": null,
  "cargo_4_temp": null,
  "relative_humidity": null,
  "avl": 0,
  "suction_pressure": -5.12,
  "discharge_pressure": -3.85,
  "line_voltage": null,
  "line_frequency": null,
  "consumption_ph_1": null,
  "consumption_ph_2": null,
  "consumption_ph_3": null,
  "co2_reading": null,
  "o2_reading": null,
  "evaporator_speed": null,
  "condenser_speed": null,
  "battery_voltage": null,
  "power_kwh": 3491.9,
  "power_trip_reading": 3353.6,
  "power_trip_duration": 133041152,
  "suction_temp": null,
  "discharge_temp": -38.5,
  "supply_air_temp": null,
  "return_air_temp": null,
  "dl_battery_temp": -5.11,
  "dl_battery_charge": 1.27,
  "power_consumption": null,
  "power_consumption_avg": 276.5,
  "suction_pressure_2": null,
  "suction_temp_2": -12.9,
  "alarm_present": 1,
  "set_point": 22,
  "capacity_load": 28,
  "power_state": 1,
  "controlling_mode": 0,
  "humidity_control": 1,
  "humidity_set_point": 95,
  "fresh_air_ex_mode": 0,
  "fresh_air_ex_rate": null,
  "fresh_air_ex_delay": null,
  "set_point_o2": null,
  "set_point_co2": null,
  "defrost_term_temp": 18,
  "defrost_interval": 6,
  "water_cooled_conde": 0,
  "usda_trip": 0,
  "evaporator_exp_valve": null,
  "suction_mod_valve": null,
  "hot_gas_valve": null,
  "economizer_valve": null,
  "numero_alarma": 0,
  "alarma_01": null,
  "alarma_02": null,
  "alarma_03": null,
  "alarma_04": null,
  "alarma_05": null,
  "alarma_06": null,
  "alarma_07": null,
  "alarma_08": null,
  "alarma_09": null,
  "alarma_10": null,
  "lecturas_erradas": {
    "temp_supply_2": "E01",
    "compress_coil_2": "E00",
    "fresh_air_ex_rate": "E01",
    "fresh_air_ex_delay": "E01",
    "set_point_o2": "E01",
    "set_point_co2": "E01",
    "evaporator_exp_valve": "E98",
    "suction_mod_valve": "E98",
    "hot_gas_valve": "E98",
    "economizer_valve": "E98",
    "lecturas_erradas": "E100",
    "ethylene": "E100"
  },
  "ethylene": null,
  "imei": "ZGRUMAD00000001",
  "ip": "10.239.31.146,13,0",
  "campo_1": 85.1,
  "campo_2": 1,
  "campo_3": 1,
  "campo_4": null,
  "campo_5": null,
  "campo_6": 0,
  "campo_7": 0,
  "campo_8": 0,
  "fecha": {
    "$date": "2026-04-24T12:47:24.120Z"
  }
},
{
  "temp_supply_1": 21.9,
  "temp_supply_2": null,
  "return_air": 26.3,
  "evaporation_coil": 19.2,
  "condensation_coil": 31.7,
  "compress_coil_1": 63.3,
  "compress_coil_2": null,
  "ambient_air": 28.1,
  "cargo_1_temp": null,
  "cargo_2_temp": null,
  "cargo_3_temp": null,
  "cargo_4_temp": null,
  "relative_humidity": 70,
  "avl": 0,
  "suction_pressure": null,
  "discharge_pressure": null,
  "line_voltage": 462,
  "line_frequency": 60,
  "consumption_ph_1": 7,
  "consumption_ph_2": 7.6,
  "consumption_ph_3": 7.5,
  "co2_reading": null,
  "o2_reading": null,
  "evaporator_speed": 60,
  "condenser_speed": 69,
  "battery_voltage": null,
  "power_kwh": 16.2,
  "power_trip_reading": 3346.2,
  "power_trip_duration": 132968448,
  "suction_temp": null,
  "discharge_temp": -38.5,
  "supply_air_temp": null,
  "return_air_temp": null,
  "dl_battery_temp": -5.11,
  "dl_battery_charge": 1.27,
  "power_consumption": 35.84,
  "power_consumption_avg": 276.49,
  "suction_pressure_2": null,
  "suction_temp_2": -12.9,
  "alarm_present": 1,
  "set_point": 22,
  "capacity_load": 11,
  "power_state": 1,
  "controlling_mode": 0,
  "humidity_control": 1,
  "humidity_set_point": 95,
  "fresh_air_ex_mode": 0,
  "fresh_air_ex_rate": null,
  "fresh_air_ex_delay": null,
  "set_point_o2": null,
  "set_point_co2": null,
  "defrost_term_temp": 18,
  "defrost_interval": 6,
  "water_cooled_conde": 0,
  "usda_trip": 0,
  "evaporator_exp_valve": null,
  "suction_mod_valve": null,
  "hot_gas_valve": null,
  "economizer_valve": null,
  "numero_alarma": 0,
  "alarma_01": null,
  "alarma_02": null,
  "alarma_03": null,
  "alarma_04": null,
  "alarma_05": null,
  "alarma_06": null,
  "alarma_07": null,
  "alarma_08": null,
  "alarma_09": null,
  "alarma_10": null,
  "lecturas_erradas": {
    "temp_supply_2": "E01",
    "compress_coil_2": "E00",
    "cargo_1_temp": "E01",
    "cargo_2_temp": "E01",
    "cargo_3_temp": "E01",
    "cargo_4_temp": "E01",
    "suction_pressure": "E01",
    "discharge_pressure": "E01",
    "co2_reading": "E01",
    "o2_reading": "E02",
    "fresh_air_ex_rate": "E01",
    "fresh_air_ex_delay": "E01",
    "set_point_o2": "E01",
    "set_point_co2": "E01",
    "evaporator_exp_valve": "E98",
    "suction_mod_valve": "E98",
    "hot_gas_valve": "E98",
    "economizer_valve": "E98",
    "lecturas_erradas": "E100",
    "ethylene": "E100"
  },
  "ethylene": null,
  "imei": "ZGRUMAD00000001",
  "ip": "10.239.31.146,14,0",
  "campo_1": 84.3,
  "campo_2": 1,
  "campo_3": 1,
  "campo_4": null,
  "campo_5": null,
  "campo_6": 0,
  "campo_7": 0,
  "campo_8": 0,
  "fecha": {
    "$date": "2026-04-07T14:43:19.851Z"
  }
},
{
  "temp_supply_1": 20.3,
  "temp_supply_2": null,
  "return_air": 27,
  "evaporation_coil": 15.5,
  "condensation_coil": 46.3,
  "compress_coil_1": 71.2,
  "compress_coil_2": null,
  "ambient_air": 27.9,
  "cargo_1_temp": null,
  "cargo_2_temp": null,
  "cargo_3_temp": null,
  "cargo_4_temp": null,
  "relative_humidity": 65,
  "avl": 0,
  "suction_pressure": null,
  "discharge_pressure": null,
  "line_voltage": 462,
  "line_frequency": 60,
  "consumption_ph_1": 7,
  "consumption_ph_2": 7.6,
  "consumption_ph_3": 7.5,
  "co2_reading": null,
  "o2_reading": null,
  "evaporator_speed": 60,
  "condenser_speed": 99,
  "battery_voltage": null,
  "power_kwh": 16.1,
  "power_trip_reading": 15.6,
  "power_trip_duration": 453986,
  "suction_temp": null,
  "discharge_temp": null,
  "supply_air_temp": 20.3,
  "return_air_temp": 27,
  "dl_battery_temp": null,
  "dl_battery_charge": 0,
  "power_consumption": 2.68,
  "power_consumption_avg": 1.08,
  "suction_pressure_2": null,
  "suction_temp_2": null,
  "alarm_present": 1,
  "set_point": 22,
  "capacity_load": 68,
  "power_state": 1,
  "controlling_mode": 0,
  "humidity_control": 1,
  "humidity_set_point": 95,
  "fresh_air_ex_mode": 0,
  "fresh_air_ex_rate": null,
  "fresh_air_ex_delay": null,
  "set_point_o2": null,
  "set_point_co2": null,
  "defrost_term_temp": 18,
  "defrost_interval": 6,
  "water_cooled_conde": 0,
  "usda_trip": 0,
  "evaporator_exp_valve": null,
  "suction_mod_valve": null,
  "hot_gas_valve": null,
  "economizer_valve": null,
  "numero_alarma": 0,
  "alarma_01": null,
  "alarma_02": null,
  "alarma_03": null,
  "alarma_04": null,
  "alarma_05": null,
  "alarma_06": null,
  "alarma_07": null,
  "alarma_08": null,
  "alarma_09": null,
  "alarma_10": null,
  "lecturas_erradas": {
    "temp_supply_2": "E01",
    "compress_coil_2": "E00",
    "cargo_1_temp": "E01",
    "cargo_2_temp": "E01",
    "cargo_3_temp": "E01",
    "cargo_4_temp": "E01",
    "suction_pressure": "E01",
    "discharge_pressure": "E01",
    "co2_reading": "E01",
    "o2_reading": "E02",
    "suction_temp": "E01",
    "discharge_temp": "E01",
    "dl_battery_temp": "E01",
    "suction_pressure_2": "E01",
    "suction_temp_2": "E00",
    "fresh_air_ex_rate": "E01",
    "fresh_air_ex_delay": "E01",
    "set_point_o2": "E01",
    "set_point_co2": "E01",
    "evaporator_exp_valve": "E98",
    "suction_mod_valve": "E98",
    "hot_gas_valve": "E98",
    "economizer_valve": "E98",
    "lecturas_erradas": "E100",
    "ethylene": "E100"
  },
  "ethylene": null,
  "imei": "ZGRUMAD00000001",
  "ip": "10.239.31.146,15,0",
  "campo_1": 82.5,
  "campo_2": 1,
  "campo_3": 1,
  "campo_4": null,
  "campo_5": null,
  "campo_6": 0,
  "campo_7": 0,
  "campo_8": 0,
  "fecha": {
    "$date": "2026-04-07T14:41:17.092Z"
  }
},
{
  "temp_supply_1": 23.1,
  "temp_supply_2": null,
  "return_air": 28.2,
  "evaporation_coil": 18.4,
  "condensation_coil": 48.5,
  "compress_coil_1": 63.7,
  "compress_coil_2": null,
  "ambient_air": 28.1,
  "cargo_1_temp": null,
  "cargo_2_temp": null,
  "cargo_3_temp": null,
  "cargo_4_temp": null,
  "relative_humidity": 67,
  "avl": 0,
  "suction_pressure": null,
  "discharge_pressure": null,
  "line_voltage": 459,
  "line_frequency": 60,
  "consumption_ph_1": 14.6,
  "consumption_ph_2": 16,
  "consumption_ph_3": 16,
  "co2_reading": null,
  "o2_reading": null,
  "evaporator_speed": 60,
  "condenser_speed": 100,
  "battery_voltage": null,
  "power_kwh": 16.1,
  "power_trip_reading": 15.6,
  "power_trip_duration": 453916,
  "suction_temp": null,
  "discharge_temp": null,
  "supply_air_temp": 23.1,
  "return_air_temp": 28.2,
  "dl_battery_temp": null,
  "dl_battery_charge": 0,
  "power_consumption": 9.53,
  "power_consumption_avg": 1.08,
  "suction_pressure_2": null,
  "suction_temp_2": null,
  "alarm_present": 1,
  "set_point": 22,
  "capacity_load": 100,
  "power_state": 1,
  "controlling_mode": 0,
  "humidity_control": 1,
  "humidity_set_point": 95,
  "fresh_air_ex_mode": 0,
  "fresh_air_ex_rate": null,
  "fresh_air_ex_delay": null,
  "set_point_o2": null,
  "set_point_co2": null,
  "defrost_term_temp": 18,
  "defrost_interval": 6,
  "water_cooled_conde": 0,
  "usda_trip": 0,
  "evaporator_exp_valve": null,
  "suction_mod_valve": null,
  "hot_gas_valve": null,
  "economizer_valve": null,
  "numero_alarma": 0,
  "alarma_01": null,
  "alarma_02": null,
  "alarma_03": null,
  "alarma_04": null,
  "alarma_05": null,
  "alarma_06": null,
  "alarma_07": null,
  "alarma_08": null,
  "alarma_09": null,
  "alarma_10": null,
  "lecturas_erradas": {
    "temp_supply_2": "E01",
    "compress_coil_2": "E00",
    "cargo_1_temp": "E01",
    "cargo_2_temp": "E01",
    "cargo_3_temp": "E01",
    "cargo_4_temp": "E01",
    "suction_pressure": "E01",
    "discharge_pressure": "E01",
    "co2_reading": "E01",
    "o2_reading": "E02",
    "suction_temp": "E01",
    "discharge_temp": "E01",
    "dl_battery_temp": "E01",
    "suction_pressure_2": "E01",
    "suction_temp_2": "E00",
    "fresh_air_ex_rate": "E01",
    "fresh_air_ex_delay": "E01",
    "set_point_o2": "E01",
    "set_point_co2": "E01",
    "evaporator_exp_valve": "E98",
    "suction_mod_valve": "E98",
    "hot_gas_valve": "E98",
    "economizer_valve": "E98",
    "lecturas_erradas": "E100",
    "ethylene": "E100"
  },
  "ethylene": null,
  "imei": "ZGRUMAD00000001",
  "ip": "10.239.31.146,14,0",
  "campo_1": 79,
  "campo_2": 1,
  "campo_3": 1,
  "campo_4": null,
  "campo_5": null,
  "campo_6": 0,
  "campo_7": 0,
  "campo_8": 0,
  "fecha": {
    "$date": "2026-04-07T14:39:15.352Z"
  }
}
]



Un madurador movil es un reefer , que controla inyeccion de gas etileno , inyeccion de vapor de agua para humedad , control de temperatura y control del co2 emitido porla fruta a travez de un sistema de ventilacion(dato avl) que es una escotilla que hace un intercambio de gas por cfm .control de Encendido y apago del equipo . 


Se requiere una funcion para simular los casos de los equipos , se propone link
IP:9090//Madurador/simular_caso/

donde se genere 7 CASOS DEMOS con los imei
imei =  ["Z_demo_manual","Z_demo_homogenizacion","Z_demo_maduracion","Z_demo_ventilacion","Z_demo_cooling", "Z_demo_automatico","z_demo_apagado","z_demo_desconocetado"]

flujo de creacion de datos llega el dato de la telemetria en que tien un imei (Z_demo_manual) , se valida en en TUNEL_proceso_madurador_MES_AÑO en este caso TUNEL_proceso_madurador_04_2026 , si existe el imei que intentamos guardar si existe se actualizan lso datos segun la estructura   <ESTRUCTURA_ULTIMOS_DATOS> , sino esta se crea la estructura y luego se añade la trama a MADURADOR_imei en este caso MADURADOR_Z_demo_manual . y asi se acumulan los datos para ser consultador por los link ya mencionados .

cada caso tiene su aspecto 
#MANUAL -> Z_demo_manual , en este caso no hay control o supervision del sistema durante el tiempo que este en este modo 

#se muestran 
#HOMOGENIZACION-> Z_demo_homogenizacion , en este caso hay control de los set_point  que es la temperatura del reefer , los parametros cargo_1_temp ,cargo_2_temp , cargo_3_temp y cargo_4_temp son sensores de temperatura del producto o fruta al interior del reefer . el set_point puede estar a 12 , y se tien programado una temperatura_objetivo , humedad_relativa  y duracion  en horas . si este proceso esta programado por 12 horas a temperatura objetivo 16 , hemedad a 95 . se programa se verifica el "humidity_set_point" , este a 95 sino esta a 95 , el sistema envia un comando CON UNA ESTRUCTURA json A la coleccion
MADURADOR_COMANDOS_MES_AÑO
# ejemplo de uno de lso documentos de MADURADOR_COMANDOS_04_2026
{
  "imei": "Z_demo_homogenizacion", 
  "estado": 0, 0 quiere decir que ya se ejecuto , 1 que esta pendiente de ejecucion 
  "fecha_creacion": {
    "$date": "2025-09-07T20:31:57.765Z"
  },
  "fecha_ejecucion": {
    "$date": "2025-09-07T20:32:28.759Z"
  },
  "comando": "HUMEDAD_95",
  "valor_actual" :91,
  "evento": "CAMBIANDO A 95 LA HUMEDAD POR PROCESO DE HOMOGENIZACION ",
  "user": "default",
  "receta": "sin receta",
  "tipo": "HOMOGENIZACION",
  "id_proceso" : 0 # 0 sino hay proceso vinculado , y algun numeor si hay un proceso 

}

y en el caso de de los cargos los ordena de mayor a menor , si estan null no considera la informacion , en el caso todos esten null , se pone el set_point a la "temperatura_objetivo" , ejemplo si observa que los sensores estan [7,6.5,6,5.5] se entiende que el producto esta frio y se quiere subir la temperatura 
se saco promedio que es 6.25 , la temperatura_objetivo es 17 , en este caso 17-6.25 =10.75 , dividimos entre 2 a un decimal redondeado 5.4 , eso lo añadimos al
temperatura_objetivo lo que sale 22.4 . "comando": "TEMPERATURA_22.4", mientras los datos de los cargos son menores a la "temperatura_objetivo" , no se cambia la temperatura por una hora , se calcula nuevamente los cargos , se promedia , calcula y se ordena la nueva temperatura ya asi sucesivamente .
en el caso de que las temperaturas sean [20,21,20,19] , se hace el mismo calculo 17-20 = -3 , en ese caso no se divide entre 2 , sino temperatura_objetivo se le resta sin dividir pues se entiende que es un esfuerzo mayor enfriar que calentar .

#MADURACION ->Z_demo_maduracion , en este caso se controla la temperatura , humedad , inyeccion de etileno , co2 , durante el tiempo de proceso . la humedad se controla tal cual como en el proceso de "HOMOGENIZACION" y la temepratura se controla que se mantenga el set_point programado . en el caso de inyeccion de etileno segun parametro "campo_1" que representa la lectura actual y el "sp_etileno" , si la lectura es menor se envia comando "INYECTAR_ETILENO" , lo evalua cada 10 minutos no envia "INYECTAR_ETILENO2 cada vez que llega una trama de telemtria , si pasaron 10 minutos y la lectura de campo_1 sigue siendo menor a sp_etileno , se vuelve enviar comando . siempre y cuando el "avl" sea  0 . si "co2_reading" es mayor a "set_point_co2"  , se envia comando "ACTIVAR_AVL" , estoa ctiva la ventilacion y los proximos datos el "avl" deberian ser mayorores de 0 . si el proceso de maduracion esta programdo para 60 horas ejemplo , las ultimas 6 horas se hace un control de temperatura , se analiza los cargos , si se cambia el set_point para estabilizar la temperatura del producto antes d eterminar la maduracion 

#VENTILACION -> Z_demo_ventilacion , se tienE un "c02_objetivo" y una duracion en minutos , ejemplo se pone "c02_objetivo" se pone 1.0 y al lectura de "co2_reading"  3.5 es mayor entonces enviar comando "ACTIVAR_AVL" , Y CAMBIAR el set_point_co2 1-3.5 = -2.5 entre 2 es 1.25 eso se resta al c02_objetivo para tener el nuevo set , como no hay negativo cambiar a 0 , se envia comando "CAMBIAR_CO2_0" y reevaluar nuevamente en este proceso cada 10 minutos si sigue mayor ejemplo ahora se pone a 1.6  ,1-1.6  es -0.6 entre 2 es -0.3 . se resta a c02_objetivo 1-03. nuevo comando a 0.7 es "CAMBIAR_CO2_0.7" , si lectura de co2_reading es menor se mantien el set "c02_objetivo"

#COOLING -> Z_demo_cooling , se tiene "temperatura_objetivo", se controla el cambio de temperatura , se evalua los cargos y tambien añadimos el  "return_air" se saca un promedio , ejemplo 23.5 de promedio , objetivo 10 . entonces 10-23.5 =-13.5  , a la temperatura objetivo se 10-13.5 =-3.5 , se orden cambiar temperatura a -3.5 . se espera cad 30 minutos en este proceso para ordenar el cambio de temperatura salvo de alguno de los cargos o el retrone sena mayor a 
"temperatura_objetivo" , asi se cambnia inmediatamente la temperatura a "temperatura_objetivo"
#AUTOMATICO  -> Z_demo_automatico , en este caso se tiene una convinacion de procesos que pueden ser HOMOGENIZACION-MADURACION-VENTILACION-COOLING . y se controla el cada proceso en su tiempo programdo , segun ya lo descrito , esat estructura tiene sus variantes , ya que el cleinte puede decidir solo poner uno o todos los procesos ejemplo MADURACION-VENTILACION , HOMOGENIZACION-MADURACION- y asi en sus variantes 

#APAGADO ->z_demo_apagado , en este caso no hay control , el equipo esta apagado , "power_state" es 0  y esta tramitiendo los datos , ultimo dato llegado con respecto a la hora del servidor menor a 60 minutos 

#DESCONECTADO ->z_demo_desconocetado , en este caso el equipo dejo de trasmitir hace mas de una hora 

Es necesario que el programa tome todo los casos y genere datos consistentes de cada uno de los procesos en lo que se encuentra y un historial de funcionamiento con datos cada 5 minutos , un historial de al menos 48 horas acorte a su proceso . y con todo la lista de comandos historicos accionados . que se guardan en colecciones MADURADOR_comandos_04_2026 y pueden ser consulatadas por imei en IP:9090//Madurador/comandos/?imei=zgru100