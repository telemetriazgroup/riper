
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



{
  "imei": "MEX1001",
  "comando": "UNIT111_GET_ETILENO",
  "dispositivo": "UNIT111",
  "evento": "Lectura de Sensor de Etileno",
  "user": "user1",
  "receta": "proceso_1",
  "tipo": 0,
  "dato": 0,
}
UNIT111_GET_ETILENO # obtener datos del etileno 
Tipo 0 -> consulta de etileno 

{
  "imei": "MEX1002",
  "comando": "UNIT222_GET_ETILENO",
  "dispositivo": "UNIT222",
  "evento": "Cambio de Temperatura",
  "user": "user1",
  "receta": "proceso_1",
  "tipo": 1,
  "dato": 20.1,
}
UNIT222_Trama_Write(0,20.1,100)
Tipo 1 -> cambio de set point de temperatura


{
  "imei": "MEX2001",
  "comando": "UNIT333_Trama_Write(8,1,1)",
  "dispositivo": "UNIT333",
  "evento": "habilita control de humedad",
  "user": "user1",
  "receta": "proceso_1",
  "tipo": 2,
  "dato": 1,
}
{
  "imei": "MEX2001",
  "comando": "UNIT333_Trama_Write(4,95,100)",
  "dispositivo": "UNIT333",
  "evento": "cambiar setpoint de humedad",
  "user": "user1",
  "receta": "proceso_1",
  "tipo": 2,
  "dato": 95,
}
UNIT333_Trama_Write(8,1,1) # habilita control de humedad 
UNIT333_Trama_Write(4,95,100) # cambiar setpoint de humedad a 95 
Tipo 2 -> Cambio de Humedad 


{
  "imei": "MEX2002",
  "comando": "UNIT444_Trama_Write(9,2,1)",
  "dispositivo": "UNIT444",
  "evento": "habilitar el afam + ",
  "user": "user1",
  "receta": "proceso_1",
  "tipo": 2,
  "dato": 2,
}
{
  "imei": "MEX2002",
  "comando": "UNIT444_Trama_Write(3,1.1,100)",
  "dispositivo": "UNIT444",
  "evento": "cambiar setpoint de co2",
  "user": "user1",
  "receta": "proceso_1",
  "tipo": 3,
  "dato": 1.1,
}
UNIT444_Trama_Write(9,2,1) #habilitar el afam + (2 automatico , 1 manual , 0 desactivado)
UNIT444_Trama_Write(3,1.1,100) # cambiar setpoint de co2  a 1.1
Tipo 3 -> Cambio de nivel de co2 


{
  "imei": "MEX3001",
  "comando": "UNIT555_Trama_Write(30,3600,1)",
  "dispositivo": "UNIT555",
  "evento": "parar la maquina STOP PLANT",
  "user": "user1",
  "receta": "proceso_1",
  "tipo": 4,
  "dato": 3600,
}
UNIT555_Trama_Write(30,3600,1) # parar la maquina por 3600 segundos o 1 hora 
Tipo 4 -> stop plan 


{
  "imei": "MEX1001",
  "comando": "UNIT111_RELE(1,40)",
  "dispositivo": "UNIT111",
  "evento": "inyectar etileno",
  "user": "user1",
  "receta": "proceso_1",
  "tipo": 5,
  "dato": 40,
}
UNIT111_RELE(1,40)   # inyectar etileno mpor 40 segundos 
Tipo 5 -> Inyectar etileno 


{
  "imei": "MEX1001",
  "comando": "UNIT111_Trama_Write(9,1,1)",
  "dispositivo": "UNIT111",
  "evento": "habilitar el afam + ",
  "user": "user1",
  "receta": "proceso_1",
  "tipo": 6,
  "dato": 1,
}
{
  "imei": "MEX1001",
  "comando": "UNIT111_Trama_Write(5,220,1)",
  "dispositivo": "UNIT111",
  "evento": "aperturar el afam en  cfm ",
  "user": "user1",
  "receta": "proceso_1",
  "tipo": 6,
  "dato": 220,
}
UNIT555_Trama_Write(9,1,1) #habilitar el afam manual (2 automatico , 1 manual , 0 desactivado)
UNIT555_Trama_Write(5,220,1) # aperturar el afam en  cfm /maximo 225
Tipo 6 -> Aperturar AVL 

{
  "imei": "MEX3001",
  "comando": "UNIT555_H_REPOSO:240*",
  "dispositivo": "UNIT555",
  "evento": "CONFIGURAR COMPRESOR PARA QUE DESCANSE ",
  "user": "user1",
  "receta": "proceso_1",
  "tipo": 7,
  "dato": 240,
}
UNIT555_H_REPOSO:240* # CONFIGURAR COMPRESOR PARA QUE DESCANSE 240 SEGUNDOS 
Tipo 7 -> CONFIGURAR COMPRESOR



# no funciona :)
Tipo 8 -> Apagar -> defenitivo 



