
Estructura para los comandos 

{
  "imei": "MEX1001",
  "estado": 1,
  "fecha_creacion": "2026-04-28T08:54:49.942000",
  "fecha_ejecucion": null,
  "comando": "UNIT111_GET_ETILENO",
  "dispositivo": "UNIT111",
  "evento": "cambio de set point jajja",
  "user": "jajaja",
  "receta": "jajaja",
  "tipo": 0,
  "status": 1,
  "dato": 14,
  "id": 0
}

ruta de insercion de json con metodo post 
http://161.132.53.51:9050/TermoKing/comando/

Logica si equipo esta emitiendo , consulatar si existe comando pendiente de ejecutar

UNIT111_GET_ETILENO # obtener datos del etileno 
Tipo 0 -> consulta de etileno 

UNIT555_Trama_Write(0,20.0,100)
Tipo 1 -> cambio de set point de temperatura

UNIT555_Trama_Write(8,1,1) # habilita control de humedad 
UNIT555_Trama_Write(4,95,100) # cambiar setpoint de humedad a 95 
Tipo 2 -> Cambio de Humedad 

UNIT555_Trama_Write(9,2,1) #habilitar el afam + (2 automatico , 1 manual , 0 desactivado)
UNIT555_Trama_Write(3,1.1,100) # cambiar setpoint de co2  a 1.1
Tipo 3 -> Cambio de nivel de co2 

UNIT555_Trama_Write(30,3600,1) # parar la maquina por 3600 segundos o 1 hora 
Tipo 4 -> stop plan 

UNIT111_RELE(1,40)   # inyectar etileno mpor 40 segundos 
Tipo 5 -> Inyectar etileno 

UNIT555_Trama_Write(9,1,1) #habilitar el afam + (2 automatico , 1 manual , 0 desactivado)
UNIT555_Trama_Write(5,220,1) # apertuarra el afam a 220 cfm /maximo 225
Tipo 6 -> Aperturar AVL 

# no funciona :)
Tipo 8 -> Apagar -> defenitivo 

GIT STAT

UNIT111_H_REPOSO:240* # CONFIGUARAR COMPRESOR PARA QUE DSCANSE 240 SEGUNDOS 
Tipo 6 -> CONFIGURAR COMPRESOR
UNIT111_H_REPOSO:240*


