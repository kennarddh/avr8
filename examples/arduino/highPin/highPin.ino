#include <avr/io.h>

int main() {
	// Set pin 13 as output
	DDRB |= (1 << PB5);

	// Set pin 13 to high
	PORTB |= (1 << PB5);

	return 0;
}