#include <util/delay.h>
#include <avr/io.h>

int main() {
	// Set pin 13 as output
	DDRB |= (1 << PB5);

	while (1) {
		// Set pin 13 to high
		PORTB |= (1 << PB5);
		_delay_ms(1000);

		// Set pin 13 to low
		PORTB &= ~(1 << PB5);
		_delay_ms(1000);
	}
}