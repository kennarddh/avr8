#include <avr/io.h>
#define io(reg) _SFR_IO_ADDR(reg)

.global main

main:
	ldi r16, 1
	ldi r17, 2
	adc r16, r17
