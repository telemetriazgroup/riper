#Vamos a actualizar la logica de enfriamiento modo cooling , el objetivo es modificar dinamicamente el set_point de la maquina para llegar al objetivo lo mas pronto posible .

tenemos en esta logica la evaluacion de los parametros de cargo_1_temp ,cargo_2_temp ,cargo_3_temp , cargo_4_temp , temp_supply_1 , return_air , evaporation_coil .


los cargo_1_temp , cargo_2_temp , cargo_3_temp , cargo_4_temp , son los sensores de temperatura interna ,para que tengan valores validos tienen que estar entre -20 y 40 grados centigrados . 
 se saca un promedio de los sensores que esten operativos , a un decimal ejemplo si solos tenemos tres sensores con datos validos 20,21y 19 > el promedio sera 20 y si solo hay uno se toma ese uno , y sino hay ninguno se toma el valor de return_air como sensor de temperatura interna .
 **Si el promedio de cargo es mayor que return_air, ese promedio se reemplaza por return_air** (el promedio no puede superar el retorno).
 entonces en el caso que se requiera enfriar el equipo a 6 grados centigrados , se valida el promedio de los sensores de temperatura interna y si son mayores a 5 grados del objetivo se cambia el set  a objetivo

**Mala lectura simultánea:** si `set_point`, `temp_supply_1`, `return_air` y `evaporation_coil` llegan todos en **0** a la vez, se ignora la trama (decisión de cualquier proceso y flota mantienen el valor anterior hasta una lectura válida). 
 
Ante todo se evalua el sensor de evaporador 

  en este caso a 6 GRADOS C , y luego de 30 minutos de haber hecho ese cambio y comporbar que el equipo esta a 6 Cº , se guarda en la trazabilidad del enfriamiento ese promedio calculado , despues de media hora se compara con el nuevo promedio .


  Contexto :

  Realizar uan funcion qu controle el envio de comnados a amaquina reefer para que ajuste potencia enviado comandos a la maquina

  descripcion de los campos :
objetivo : Temperatura objetivo del producto en grados centigrados , debe ser mayor o igual a 0 

set_point : set temperatura de la maquina reefer en celcius , sera la potencia de enfriamiento de la maquina 

temp_supply_1 : Temperatura suministrada por la maquina reefer , esta limitada por el set_point .

return_air : Tempeartura de retorno de interior de la camara , despues de que el suministro haya pasado por todo el producto .

cargo_1_temp : Temperatura interna de la camara Zona 1 

cargo_2_temp : Temperatura interna de la camara Zona 2 

cargo_3_temp : Temperatura interna de la camara Zona 3 

cargo_4_temp : Temperatura interna de la camara Zona 4

evaporation_coil : Temperatura de evaporador 

Recordar ultimo cambio de set_point
-> PRIMER EVENTO : Validar estado de evaporation_coil 

evaporation_coil menor que -6.5 -> Evaluar set_point !=  objetivo ->SI ->Cambiar set_point a Objetivo -ultimo cambio de set_point mas de 5 
                                                        |
                                                        |-> SINO->Cambiar set_point a return_air-ultimo cambio de set_point mas de 5 minutos                          
 
 evaporation_coil menor que -9.9 -> Evaluar set_point !=  objetivo ->SI ->Cambiar set_point a return_air
                                                          |
                                                          |-> SINO ->  Evaluar  set point > return_air -> SI -> ENVIAR A DEFROST  
                                                                                            |
                                                                                            |->SINO ->  Cambiar set_point a return_air



evaporation_coil menor que -14.9 -> Se envio defrost hace mas de 5 minutos ? -> SI -> VOLVER A ENVIAR DEFROST

Banda intermedia: evaporation_coil entre -6.5 y -6 (inclusive) → sin comando.

Tope de set_point: no bajar más de 8 °C bajo el objetivo (obj 3 → mín -5).
Si set actual < objetivo-8 (ej. -9) → cambiar set a objetivo.

Si return_air < objetivo (enfriamiento casi terminado) Y hay cargos USDA válidos:
  ordenar USDA (cargo_1..4) de menor a mayor → promedio
  si promedio USDA < objetivo → set_point = objetivo - 1
  si no → set_point = objetivo - 2
  si ya está en ese set → no bajar más (mantener con set ligero)
Si no hay cargos válidos → seguir lógica normal de return_air / evaporador.

si evaporation_coil mayor a -6  Entonces : 

            RECORDAR ULTIMOS  CAMBIO DE SETPOINT 

            CONSULTAR set_point es mayor que Objetivo ->SI -> cambiar set_point a Objetivo
                                                    |
                                                    |->SINO -> set_point = Objetivo  -> SI -> Cambiar  set_point a Objetivo-4
                                                                                |
                                                                                |->SINO -> se entiende que  set_point es menor 
                                                                                            se verifcia ultimos  de set_point
                                                                                            si el ultimo cambio de set_point se dio hace
                                                                                            mas de 10 minutos . cambiar set_point actual en -1 .

crear una logica estructurada , donde se cosulte el ultimo cambio de set_point , se tenga los datos descrito y se evalue la posicion de cambiar de potencia 

En modo cooling 
para consultar el ultimo cambio de set_point

http://161.132.53.51:9050/TermoKing/ultimo_control/{imei}

que puede ser : 
http://161.132.53.51:9050/TermoKing/ultimo_control/NEWY2001

y puede ser null o tener la siguiente estructura :
	

{
  "imei": "NEWY2001",
  "comando": "UNIT111_Trama_Write(0,0.4,100)",
  "dispositivo": "UNIT111",
  "evento": "Cambio de Temperatura",
  "user": "DESDE SERVIDOR MANUAL",
  "receta": "SIN_RECETA",
  "estado": 0,
  "tipo": "1",
  "dato": "0.4",
  "fecha_creacion": "2026-07-31T13:29:04.575000",
  "fecha_ejecucion": "2026-07-31T13:29:12.681000",
  "status": 2
}

ahi tengo el dato que es"0.4" que es el ultimo set_point a lo que se cambio y tengo fecha_ejecucion que es la fecha en la que se ejcuto esa orden , el estado 0 significa ejecuitado , el estado 1 se significa por ejecutar , sino hay  fecha_ejeccuion s etoma la fecha_creacion .

**Zona horaria:** `fecha_ejecucion` / `fecha_creacion` vienen **sin offset** pero en reloj **GMT-5**. Si se interpretan como UTC (p. ej. contenedor `TZ=UTC`), el “hace X min” sale ~300 min de más y se saltan los cooldowns de 5/10 min. En Ripener se parsean con `TERMOKING_ULTIMO_CONTROL_TZ_OFFSET=-05:00`. 

entonces cunado un equipo esta el proceso de cooling se analiza los datos y se hace seguimiento de los paraemtros : set_point ,temp_supply_1, return_air ,cargo_1_temp ,cargo_2_temp.cargo_3_temp.cargo_4_temp y evaporation_coil .

**controlling_mode = 4 (obligatorio):** sin este modo el equipo no activa potencia.
Si `controlling_mode` no es 4, enviar:
`http://161.132.53.51:9051/TermoKing/comando_control/{imei}?tipo=11&dato=4`
(validar en cada ciclo; reenvío con cooldown ~5 min).

se hace cambio de set point enviando en el respectivo comando 

en el  link que corresponda del tipo 1 se refiere a comandar temepratura y dato 3 se refiere a la temperatura a cambiar 
http://161.132.53.51:9051/TermoKing/comando_control/NEWY1001?tipo=1&dato=3
http://161.132.53.51:9051/Tunel/comando_control_tunel/NEWY1001?tipo=1&dato=3

y para enviar hacer defrost de tipo8 y el dato siempre es 1
http://161.132.53.51:9051/TermoKing/comando_control/NEWY1001?tipo=8&dato=1
http://161.132.53.51:9051/Tunel/comando_control_tunel/NEWY1001?tipo=8&dato=1

la idea es que cunado este en modo cooling analice el estado actual , vaya guardando las deciones que toma . ejemplo si pasa un minutto y el ultimo dado es el mismo no hubo actualizacion de datos , no entra en la comparacion para tomar decision , si paso otro minuto y cambia el ultimo dato analizado ahi se acticva el algoritmo siempre consultado el ultimo cambio de set-point para no esar cambiando set_poibt a cada rat y igual con eñl defrost , sino enviariamos varios comandos y no habria un control 

## Trazabilidad de decisiones (análisis)

Cada vez que Cooling **cambia set_point** o **manda DEFROST**, se guarda en bitácora y en `processAutomation.coolingDecisionLog`:

- **Por qué** (`reasonCode` + texto `analysisEs`)
- **Qué cambio** (set anterior → nuevo, o defrost tipo 8)
- **Con qué datos** (objetivo, set_point, return_air, supply, evaporation_coil, cargos 1–4, promedio interno)
- **Timing** (tiempo desde último set / defrost vía `ultimo_control`)

Así se puede auditar después por qué se tomó cada decisión.

